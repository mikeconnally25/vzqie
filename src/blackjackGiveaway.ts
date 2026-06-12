import { allowed } from "./blacklist.js";
import {
  BlackjackGame,
  formatHand,
  handValue,
  isBusted,
  type HandOutcome,
} from "./blackjack.js";
import { GiveawayEngine } from "./giveawayEngine.js";
import type { GiveawayEngineOptions } from "./giveawayEngine.js";
import type { ChatMessage, Participant, WinRecord } from "./types.js";
import { normalizeUsername } from "./utils.js";

export type BlackjackPhase =
  | "idle"
  | "entering"
  | "voting"
  | "resolved";

export type VoteChoice = "hit" | "stand";

export interface BlackjackGiveawayOptions extends GiveawayEngineOptions {
  voteWindowMs?: number;
  mods?: string[];
  enterCommand?: string;
  hitCommand?: string;
  standCommand?: string;
  startCommand?: string;
  dealCommand?: string;
  statusCommand?: string;
  drawOnLoss?: boolean;
}

export interface BotReply {
  channel: "chat" | "system";
  text: string;
}

export interface VoteSnapshot {
  hit: number;
  stand: number;
  voters: string[];
}

export interface BlackjackRoundState {
  phase: BlackjackPhase;
  playerHand: string;
  dealerHand: string;
  playerTotal: number;
  dealerTotal: number;
  votes: VoteSnapshot;
  outcome?: HandOutcome;
  winner?: Participant;
}

const DEFAULT_VOTE_WINDOW_MS = 15_000;

function parseCommand(message: string): string {
  return message.trim().toLowerCase().split(/\s+/)[0] ?? "";
}

function isMod(username: string, mods: Set<string>): boolean {
  return mods.has(normalizeUsername(username));
}

export class BlackjackGiveawayBot {
  private readonly engine: GiveawayEngine;
  private readonly voteWindowMs: number;
  private readonly mods: Set<string>;
  private readonly enterCommand: string;
  private readonly hitCommand: string;
  private readonly standCommand: string;
  private readonly startCommand: string;
  private readonly dealCommand: string;
  private readonly statusCommand: string;
  private readonly drawOnLoss: boolean;
  private readonly now: () => number;

  private phase: BlackjackPhase = "idle";
  private game: BlackjackGame | null = null;
  private votes = new Map<string, VoteChoice>();
  private voteDeadline = 0;
  private previousWins: WinRecord[] = [];
  private lastWinner: Participant | undefined;
  private pendingReplies: BotReply[] = [];

  constructor(options: BlackjackGiveawayOptions = {}) {
    this.engine = new GiveawayEngine(options);
    this.voteWindowMs = options.voteWindowMs ?? DEFAULT_VOTE_WINDOW_MS;
    this.mods = new Set((options.mods ?? []).map(normalizeUsername));
    this.enterCommand = options.enterCommand ?? "!enter";
    this.hitCommand = options.hitCommand ?? "!hit";
    this.standCommand = options.standCommand ?? "!stand";
    this.startCommand = options.startCommand ?? "!bjstart";
    this.dealCommand = options.dealCommand ?? "!bjdeal";
    this.statusCommand = options.statusCommand ?? "!bj";
    this.drawOnLoss = options.drawOnLoss ?? false;
    this.now = options.now ?? Date.now;
  }

  drainReplies(): BotReply[] {
    const replies = this.pendingReplies;
    this.pendingReplies = [];
    return replies;
  }

  tick(): BotReply[] {
    this.enqueueReplies(this.syncVotingWindow());
    return this.drainReplies();
  }

  getPhase(): BlackjackPhase {
    this.enqueueReplies(this.syncVotingWindow());
    return this.phase;
  }

  getState(): BlackjackRoundState {
    this.enqueueReplies(this.syncVotingWindow());

    const playerCards = this.game?.playerHand ?? [];
    const dealerCards = this.game?.dealerHand ?? [];

    return {
      phase: this.phase,
      playerHand: formatHand(playerCards),
      dealerHand: formatHand(dealerCards),
      playerTotal: handValue(playerCards),
      dealerTotal: handValue(dealerCards),
      votes: this.getVoteSnapshot(),
      outcome: this.game?.outcome() ?? undefined,
      winner: this.lastWinner,
    };
  }

  handleMessage(message: ChatMessage): BotReply[] {
    if (!allowed(message.username)) {
      return [];
    }

    const command = parseCommand(message.message);
    const replies: BotReply[] = [];

    if (command === this.enterCommand) {
      const result = this.engine.addMessage(message);

      if (result?.status === "entered") {
        replies.push({
          channel: "chat",
          text: `@${message.username} entered the giveaway!`,
        });
      } else if (result?.status === "pending_approval") {
        replies.push({
          channel: "system",
          text: `@${message.username} is pending mod approval (risk: ${result.riskLevel}).`,
        });
      } else if (result?.status === "rejected") {
        replies.push({
          channel: "chat",
          text: `@${message.username} was rejected from this giveaway.`,
        });
      }

      return replies;
    }

    if (command === this.statusCommand) {
      return [this.buildStatusReply()];
    }

    if (command === this.startCommand) {
      if (!isMod(message.username, this.mods)) {
        return [
          {
            channel: "chat",
            text: `@${message.username} only mods can start a blackjack giveaway.`,
          },
        ];
      }

      return this.startGiveaway();
    }

    if (command === this.dealCommand) {
      if (!isMod(message.username, this.mods)) {
        return [
          {
            channel: "chat",
            text: `@${message.username} only mods can deal a blackjack hand.`,
          },
        ];
      }

      return this.dealHand();
    }

    if (this.phase === "voting") {
      if (command === this.hitCommand) {
        return this.registerVote(message.username, "hit");
      }

      if (command === this.standCommand) {
        return this.registerVote(message.username, "stand");
      }
    }

    return replies;
  }

  startGiveaway(): BotReply[] {
    this.phase = "entering";
    this.game = null;
    this.votes.clear();
    this.voteDeadline = 0;
    this.lastWinner = undefined;

    const eligible = this.engine.getEligibleParticipants(this.now()).length;

    return [
      {
        channel: "chat",
        text: `Blackjack giveaway is open! Type ${this.enterCommand} to join. Mods: use ${this.dealCommand} when ready.`,
      },
      {
        channel: "system",
        text: `${eligible} eligible participant(s) currently in the pool.`,
      },
    ];
  }

  dealHand(): BotReply[] {
    if (this.phase !== "entering" && this.phase !== "resolved") {
      return [
        {
          channel: "chat",
          text: `Start a round first with ${this.startCommand}.`,
        },
      ];
    }

    const eligible = this.engine.getEligibleParticipants(this.now());

    if (eligible.length === 0) {
      return [
        {
          channel: "chat",
          text: `No eligible entrants yet. Chat can type ${this.enterCommand} to join.`,
        },
      ];
    }

    this.game = new BlackjackGame();
    this.game.deal();
    this.votes.clear();
    this.phase = "voting";
    this.voteDeadline = this.now() + this.voteWindowMs;
    this.lastWinner = undefined;

    const playerCards = this.game.playerHand;
    const dealerUpCard = this.game.dealerHand[0]!;

    if (this.game.isRoundOver()) {
      return this.resolveRound();
    }

    return [
      {
        channel: "chat",
        text: `Cards dealt! Player: ${formatHand(playerCards)} (${handValue(playerCards)}). Dealer shows: ${formatHand([dealerUpCard])}. Vote ${this.hitCommand} or ${this.standCommand} in the next ${Math.round(this.voteWindowMs / 1000)}s!`,
      },
    ];
  }

  registerVote(username: string, choice: VoteChoice): BotReply[] {
    this.enqueueReplies(this.syncVotingWindow());

    if (this.phase !== "voting" || !this.game) {
      return [];
    }

    const normalized = normalizeUsername(username);
    const changed = this.votes.get(normalized) !== choice;
    this.votes.set(normalized, choice);

    if (!changed) {
      return [];
    }

    const snapshot = this.getVoteSnapshot();
    const remainingMs = Math.max(0, this.voteDeadline - this.now());

    return [
      {
        channel: "chat",
        text: `@${username} voted ${choice.toUpperCase()}! (${snapshot.hit} hit / ${snapshot.stand} stand, ${Math.ceil(remainingMs / 1000)}s left)`,
      },
    ];
  }

  forceResolve(): BotReply[] {
    if (this.phase !== "voting") {
      return [];
    }

    return this.resolveRound();
  }

  private enqueueReplies(replies: BotReply[]): void {
    if (replies.length > 0) {
      this.pendingReplies.push(...replies);
    }
  }

  private syncVotingWindow(): BotReply[] {
    if (this.phase !== "voting") {
      return [];
    }

    if (this.now() >= this.voteDeadline) {
      return this.resolveRound();
    }

    return [];
  }

  private resolveRound(): BotReply[] {
    const game = this.game;

    if (!game) {
      return [];
    }

    if (game.canHit() || game.canStand()) {
      const choice = this.pickWinningVote();
      const actionReply =
        choice === "hit"
          ? this.executeHit(game)
          : this.executeStand(game);

      if (!game.isRoundOver()) {
        this.beginNextVoteWindow();
        return actionReply;
      }
    }

    this.phase = "resolved";
    const outcome = game.outcome() ?? "lose";
    const replies: BotReply[] = [
      {
        channel: "chat",
        text: `Final hand — Player: ${formatHand(game.playerHand)} (${handValue(game.playerHand)}). Dealer: ${formatHand(game.dealerHand)} (${handValue(game.dealerHand)}). Result: ${outcome.toUpperCase()}!`,
      },
    ];

    if (game.playerWon() || this.drawOnLoss) {
      const winners = this.engine.draw(1, this.previousWins, this.now());
      const winner = winners[0];

      if (winner) {
        this.lastWinner = winner;
        this.previousWins.push({
          username: winner.username,
          timestamp: this.now(),
        });

        replies.push({
          channel: "chat",
          text: `Giveaway winner: @${winner.username}!`,
        });
      } else {
        replies.push({
          channel: "chat",
          text: "No eligible winner could be drawn from the entry pool.",
        });
      }
    } else {
      replies.push({
        channel: "chat",
        text: "The table lost — no giveaway winner this round. Type !bjstart to try again!",
      });
    }

    return replies;
  }

  private beginNextVoteWindow(): void {
    this.votes.clear();
    this.voteDeadline = this.now() + this.voteWindowMs;
  }

  private pickWinningVote(): VoteChoice {
    const snapshot = this.getVoteSnapshot();

    if (snapshot.hit > snapshot.stand) {
      return "hit";
    }

    if (snapshot.stand > snapshot.hit) {
      return "stand";
    }

    return "stand";
  }

  private executeHit(game: BlackjackGame): BotReply[] {
    game.hit();

    if (isBusted(game.playerHand)) {
      return [
        {
          channel: "chat",
          text: `Chat voted HIT. Player draws and busts with ${formatHand(game.playerHand)} (${handValue(game.playerHand)})!`,
        },
      ];
    }

    return [
      {
        channel: "chat",
        text: `Chat voted HIT. Player: ${formatHand(game.playerHand)} (${handValue(game.playerHand)}). Vote ${this.hitCommand} or ${this.standCommand} again!`,
      },
    ];
  }

  private executeStand(game: BlackjackGame): BotReply[] {
    game.stand();

    return [
      {
        channel: "chat",
        text: `Chat voted STAND at ${formatHand(game.playerHand)} (${handValue(game.playerHand)}). Dealer reveals...`,
      },
    ];
  }

  private getVoteSnapshot(): VoteSnapshot {
    let hit = 0;
    let stand = 0;

    for (const choice of this.votes.values()) {
      if (choice === "hit") {
        hit += 1;
      } else {
        stand += 1;
      }
    }

    return {
      hit,
      stand,
      voters: [...this.votes.keys()],
    };
  }

  private buildStatusReply(): BotReply {
    const state = this.getState();
    const voteText =
      state.phase === "voting"
        ? ` Votes: ${state.votes.hit} hit / ${state.votes.stand} stand.`
        : "";

    return {
      channel: "chat",
      text: `Blackjack giveaway [${state.phase}] — Player: ${state.playerHand || "n/a"} (${state.playerTotal}). Dealer: ${state.dealerHand || "n/a"} (${state.dealerTotal}).${voteText}`,
    };
  }
}
