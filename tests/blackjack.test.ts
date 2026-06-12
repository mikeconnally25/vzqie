import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BlackjackGame,
  cardValue,
  compareHands,
  createDeck,
  formatHand,
  handValue,
  type Card,
} from "../src/blackjack.js";

function card(rank: Card["rank"], suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

describe("blackjack", () => {
  it("calculates soft and hard ace values", () => {
    assert.equal(handValue([card("A"), card("9")]), 20);
    assert.equal(handValue([card("A"), card("8"), card("5")]), 14);
    assert.equal(handValue([card("K"), card("Q")]), 20);
  });

  it("compares player and dealer outcomes", () => {
    assert.equal(
      compareHands([card("10"), card("9")], [card("10"), card("8")]),
      "win"
    );
    assert.equal(
      compareHands([card("10"), card("6")], [card("10"), card("9")]),
      "lose"
    );
    assert.equal(
      compareHands([card("A"), card("K")], [card("10"), card("9")]),
      "blackjack"
    );
  });

  it("lets the dealer hit until seventeen", () => {
    const deck: Card[] = [card("2"), card("5"), card("10"), card("6"), card("10")];
    const game = new BlackjackGame({ deck });

    game.deal();
    game.stand();

    assert.equal(handValue(game.dealerHand), 17);
    assert.equal(game.outcome(), "lose");
  });

  it("supports repeated hits controlled by chat votes", () => {
    const deck: Card[] = [card("3"), card("9"), card("10"), card("5"), card("5")];
    const game = new BlackjackGame({ deck });

    game.deal();
    assert.equal(handValue(game.playerHand), 10);
    assert.ok(game.hit());
    assert.equal(handValue(game.playerHand), 13);
    assert.ok(game.stand());
    assert.ok(game.isRoundOver());
  });

  it("creates a shuffled fifty-two card deck", () => {
    const deck = createDeck(() => 0.5);
    assert.equal(deck.length, 52);
    assert.equal(new Set(deck.map((entry) => `${entry.rank}${entry.suit}`)).size, 52);
    assert.equal(formatHand(deck.slice(0, 2)).length > 0, true);
    assert.equal(cardValue("K"), 10);
  });
});
