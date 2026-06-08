import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluatePaylines } from '../../src/slot/duelReels.js';
import type { SymbolId } from '../../src/slot/types.js';

function gridFromRows(rows: SymbolId[][]): SymbolId[][] {
  return rows;
}

describe('payline evaluation', () => {
  it('pays lines that start with wild symbols', () => {
    const grid = gridFromRows([
      ['WILD', 'WILD', 'JERSEY', 'JERSEY', 'JERSEY'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
    ]);

    const { wins } = evaluatePaylines(grid, []);
    const topLine = wins.find((win) => win.paylineIndex === 0);
    assert.ok(topLine);
    assert.equal(topLine.symbol, 'JERSEY');
    assert.equal(topLine.count, 5);
    assert.equal(topLine.totalPayout, 25);
  });

  it('pays five wild symbols on a line', () => {
    const grid = gridFromRows([
      ['WILD', 'WILD', 'WILD', 'WILD', 'WILD'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
    ]);

    const { wins } = evaluatePaylines(grid, []);
    const topLine = wins.find((win) => win.paylineIndex === 0);
    assert.ok(topLine);
    assert.equal(topLine.symbol, 'WILD');
    assert.equal(topLine.count, 5);
  });

  it('applies stacked duel multipliers to a winning line', () => {
    const grid = gridFromRows([
      ['JERSEY', 'JERSEY', 'JERSEY', 'JERSEY', 'JERSEY'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
      ['WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE', 'WHISTLE'],
    ]);

    const duelReels = [
      { col: 0, multiplier: 5, expanded: true },
      { col: 1, multiplier: 10, expanded: true },
    ];

    const { wins } = evaluatePaylines(grid, duelReels);
    assert.equal(wins[0].multiplier, 15);
    assert.equal(wins[0].totalPayout, 25 * 15);
  });
});
