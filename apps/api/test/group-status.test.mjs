import { describe, it, expect } from '@jest/globals';
import { transition } from '../dist/groups/status.js';
describe('group state transitions', () => {
  const states = ['DRAFT', 'OPEN', 'CLOSED', 'ORDERED', 'SETTLED', 'CANCELLED'];
  const allowed = new Set([
    'DRAFT:OPEN',
    'DRAFT:CANCELLED',
    'OPEN:CLOSED',
    'OPEN:CANCELLED',
    'CLOSED:ORDERED',
    'CLOSED:CANCELLED',
    'ORDERED:SETTLED',
  ]);
  for (const from of states)
    for (const to of states) {
      it(`${from} -> ${to}`, () => {
        if (allowed.has(`${from}:${to}`)) expect(transition(from, to)).toBe(to);
        else expect(() => transition(from, to)).toThrow();
      });
    }
});
