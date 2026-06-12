export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type HandOutcome = "blackjack" | "win" | "lose" | "push";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

function secureRandom(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]! / (0xffffffff + 1);
}

export function createDeck(random: () => number = secureRandom): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = deck[index]!;
    deck[index] = deck[swapIndex]!;
    deck[swapIndex] = current;
  }

  return deck;
}

export function cardValue(rank: Rank): number {
  if (rank === "A") {
    return 11;
  }

  if (rank === "J" || rank === "Q" || rank === "K") {
    return 10;
  }

  return Number(rank);
}

export function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += cardValue(card.rank);

    if (card.rank === "A") {
      aces += 1;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function isTenValue(rank: Rank): boolean {
  return rank === "10" || rank === "J" || rank === "Q" || rank === "K";
}

export function isBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) {
    return false;
  }

  const ranks = cards.map((card) => card.rank);
  const hasAce = ranks.includes("A");
  const hasTen = ranks.some(isTenValue);

  return hasAce && hasTen;
}

export function isBusted(cards: Card[]): boolean {
  return handValue(cards) > 21;
}

export function formatCard(card: Card): string {
  return `${card.rank}${card.suit[0]!.toUpperCase()}`;
}

export function formatHand(cards: Card[]): string {
  return cards.map(formatCard).join(" ");
}

export function compareHands(
  playerCards: Card[],
  dealerCards: Card[]
): HandOutcome {
  const playerBlackjack = isBlackjack(playerCards);
  const dealerBlackjack = isBlackjack(dealerCards);

  if (playerBlackjack && dealerBlackjack) {
    return "push";
  }

  if (playerBlackjack) {
    return "blackjack";
  }

  if (dealerBlackjack) {
    return "lose";
  }

  const playerTotal = handValue(playerCards);
  const dealerTotal = handValue(dealerCards);

  if (playerTotal > 21) {
    return "lose";
  }

  if (dealerTotal > 21) {
    return "win";
  }

  if (playerTotal > dealerTotal) {
    return "win";
  }

  if (playerTotal < dealerTotal) {
    return "lose";
  }

  return "push";
}

export class BlackjackGame {
  private deck: Card[] = [];
  readonly playerHand: Card[] = [];
  readonly dealerHand: Card[] = [];
  private random: () => number;
  private playerStood = false;

  constructor(options: { random?: () => number; deck?: Card[] } = {}) {
    this.random = options.random ?? secureRandom;
    this.deck = options.deck ? [...options.deck] : createDeck(this.random);
  }

  deal(): void {
    this.playerHand.length = 0;
    this.dealerHand.length = 0;
    this.playerStood = false;

    this.playerHand.push(this.drawCard(), this.drawCard());
    this.dealerHand.push(this.drawCard(), this.drawCard());
  }

  hit(): boolean {
    if (this.isRoundOver()) {
      return false;
    }

    this.playerHand.push(this.drawCard());
    return true;
  }

  stand(): boolean {
    if (this.isRoundOver()) {
      return false;
    }

    this.playerStood = true;
    this.playDealer();
    return true;
  }

  canHit(): boolean {
    return !this.isRoundOver() && !this.playerStood && !isBusted(this.playerHand);
  }

  canStand(): boolean {
    return !this.isRoundOver() && !this.playerStood && !isBusted(this.playerHand);
  }

  isRoundOver(): boolean {
    if (this.playerStood) {
      return true;
    }

    if (isBusted(this.playerHand)) {
      return true;
    }

    if (isBlackjack(this.playerHand) || isBlackjack(this.dealerHand)) {
      return true;
    }

    return false;
  }

  outcome(): HandOutcome | null {
    if (!this.isRoundOver()) {
      return null;
    }

    return compareHands(this.playerHand, this.dealerHand);
  }

  playerWon(): boolean {
    const result = this.outcome();
    return result === "win" || result === "blackjack";
  }

  private playDealer(): void {
    while (handValue(this.dealerHand) < 17) {
      this.dealerHand.push(this.drawCard());
    }
  }

  private drawCard(): Card {
    const card = this.deck.pop();

    if (!card) {
      this.deck = createDeck(this.random);
      return this.drawCard();
    }

    return card;
  }
}
