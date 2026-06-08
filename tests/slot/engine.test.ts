import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GRID_COLS,
  GRID_ROWS,
  PAYLINES,
  SYMBOLS,
  createGameState,
  canSpin,
  spin,
  setBet,
} from '../../src/slot/index.js';
import type { Rng } from '../../src/slot/rng.js';

function seededRng(seed: number): Rng {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe('slot constants', () => {
  it('defines a 5x5 grid with 15 paylines', () => {
    assert.equal(GRID_ROWS, 5);
    assert.equal(GRID_COLS, 5);
    assert.equal(PAYLINES.length, 15);
    assert.ok(SYMBOLS.VS);
    assert.ok(SYMBOLS.SCATTER_COMEBACK);
  });
});

describe('slot engine', () => {
  it('creates a game with default balance', () => {
    const state = createGameState();
    assert.equal(state.balance, 1000);
    assert.equal(state.phase, 'base');
    assert.equal(state.bet, 0.2);
  });

  it('deducts bet on paid spins', () => {
    const state = createGameState(100, 1);
    const { state: next } = spin(state, seededRng(42));
    assert.equal(next.balance <= 99, true);
  });

  it('does not deduct bet during free spins', () => {
    let state = createGameState(100, 1);
    state = {
      ...state,
      phase: 'comeback',
      freeSpinsRemaining: 3,
      stickyWilds: [],
    };
    const before = state.balance;
    const { state: next } = spin(state, seededRng(99));
    assert.equal(next.balance >= before, true);
  });

  it('refuses spin when balance is too low', () => {
    const state = createGameState(0.1, 1);
    assert.equal(canSpin(state), false);
    assert.throws(() => spin(state, seededRng(1)), /Insufficient balance/);
  });

  it('produces a valid grid after spin', () => {
    const state = createGameState(100, 1);
    const { result } = spin(state, seededRng(7));
    assert.equal(result.grid.length, GRID_ROWS);
    assert.equal(result.grid[0].length, GRID_COLS);
  });

  it('allows bet changes', () => {
    const state = setBet(createGameState(), 5);
    assert.equal(state.bet, 5);
  });

  it('can award duel reel multipliers', () => {
    let foundDuel = false;
    for (let seed = 0; seed < 200; seed++) {
      const state = createGameState(10000, 1);
      const { result } = spin(state, seededRng(seed));
      if (result.duelReels.length > 0) {
        foundDuel = true;
        assert.ok(result.duelReels[0].multiplier >= 2);
        break;
      }
    }
    assert.equal(foundDuel, true);
  });
});
