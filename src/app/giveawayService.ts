import { KickChatProvider } from "../kick/KickChatProvider.js";
import { GiveawayEngine } from "../giveawayEngine.js";
import type { EntryResult } from "../giveawayEngine.js";
import type { ChatMessage, Participant, WinRecord } from "../types.js";

export interface GiveawayServiceConfig {
  channel: string;
  chatroomId?: number;
  entryKeyword?: string;
  debug?: boolean;
}

export interface EntryLogItem {
  id: string;
  username: string;
  message: string;
  status: EntryResult["status"];
  riskLevel?: EntryResult["riskLevel"];
  timestamp: number;
}

export interface DashboardState {
  channel: string;
  chatConnected: boolean;
  entryKeyword: string;
  eligible: Participant[];
  recentEntries: EntryLogItem[];
  winners: Array<{ username: string; timestamp: number }>;
}

export type GiveawayEvent =
  | { type: "state"; payload: DashboardState }
  | { type: "entry"; payload: EntryLogItem }
  | { type: "winner"; payload: { username: string; timestamp: number } }
  | {
      type: "chat_status";
      payload: { connected: boolean; channel: string; error?: string };
    };

export class GiveawayService {
  private readonly engine: GiveawayEngine;
  private readonly chat: KickChatProvider;
  private readonly entryKeyword: string;
  private readonly listeners = new Set<(event: GiveawayEvent) => void>();
  private readonly recentEntries: EntryLogItem[] = [];
  private readonly previousWins: WinRecord[] = [];
  private chatConnected = false;

  constructor(private readonly config: GiveawayServiceConfig) {
    this.entryKeyword = (config.entryKeyword ?? "!enter").toLowerCase();

    this.engine = new GiveawayEngine();

    this.chat = new KickChatProvider({
      channel: config.channel,
      chatroomId: config.chatroomId,
      debug: config.debug,
    });

    this.chat.onMessage((message) => this.handleChatMessage(message));
  }

  onEvent(listener: (event: GiveawayEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    try {
      await this.chat.connect();
      this.chatConnected = true;
      this.emit({
        type: "chat_status",
        payload: { connected: true, channel: this.config.channel },
      });
    } catch (error) {
      this.chatConnected = false;
      this.emit({
        type: "chat_status",
        payload: {
          connected: false,
          channel: this.config.channel,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }

    this.broadcastState();
  }

  async stop(): Promise<void> {
    await this.chat.disconnect();
    this.chatConnected = false;
    this.emit({
      type: "chat_status",
      payload: { connected: false, channel: this.config.channel },
    });
  }

  draw(count = 1): Participant[] {
    const winners = this.engine.draw(count, this.previousWins);

    for (const winner of winners) {
      const record = { username: winner.username, timestamp: Date.now() };
      this.previousWins.push(record);
      this.emit({ type: "winner", payload: record });
    }

    this.broadcastState();
    return winners;
  }

  getState(): DashboardState {
    return {
      channel: this.config.channel,
      chatConnected: this.chatConnected,
      entryKeyword: this.entryKeyword,
      eligible: this.engine.getEligibleParticipants(),
      recentEntries: [...this.recentEntries],
      winners: this.previousWins.map((win) => ({
        username: win.username,
        timestamp: win.timestamp,
      })),
    };
  }

  private handleChatMessage(message: ChatMessage): void {
    if (!message.message.toLowerCase().includes(this.entryKeyword)) {
      return;
    }

    const result = this.engine.addMessage(message);
    if (!result) {
      return;
    }

    const entry: EntryLogItem = {
      id: `${message.username}-${message.timestamp}`,
      username: message.username,
      message: message.message,
      status: result.status,
      riskLevel: result.riskLevel,
      timestamp: message.timestamp,
    };

    this.recentEntries.unshift(entry);
    if (this.recentEntries.length > 50) {
      this.recentEntries.pop();
    }

    this.emit({ type: "entry", payload: entry });
    this.broadcastState();
  }

  private broadcastState(): void {
    this.emit({ type: "state", payload: this.getState() });
  }

  private emit(event: GiveawayEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export function loadGiveawayConfig(): GiveawayServiceConfig {
  const channel = process.env.KICK_CHANNEL?.trim();
  const chatroomId = Number.parseInt(process.env.KICK_CHATROOM_ID ?? "", 10);

  if (!channel) {
    throw new Error("Missing KICK_CHANNEL environment variable.");
  }

  if (process.env.KICK_CHATROOM_ID && Number.isNaN(chatroomId)) {
    throw new Error("KICK_CHATROOM_ID must be a number.");
  }

  return {
    channel,
    chatroomId: Number.isNaN(chatroomId) ? undefined : chatroomId,
    entryKeyword: process.env.GIVEAWAY_KEYWORD ?? "!enter",
    debug: process.env.KICK_DEBUG === "1",
  };
}
