import { describe, it, expect } from '@jest/globals';
import {
  generateCredential,
  hashCredential,
  matchesCredential,
  normalizeNickname,
} from '../dist/identity/credentials.js';

describe('participant credentials and nicknames', () => {
  it('generates distinct 32-byte credentials and stores only their hash', () => {
    const first = generateCredential();
    expect(Buffer.from(first, 'base64url')).toHaveLength(32);
    expect(first).not.toBe(generateCredential());
    expect(hashCredential(first)).toHaveLength(64);
    expect(matchesCredential(first, hashCredential(first))).toBe(true);
    expect(matchesCredential('wrong', hashCredential(first))).toBe(false);
    expect(matchesCredential(first, 'invalid')).toBe(false);
  });
  it('trims surrounding whitespace and ignores case in the unique key', () => {
    expect(normalizeNickname(' \tAlice\n')).toEqual({
      nickname: 'Alice',
      nicknameKey: 'alice',
    });
    expect(normalizeNickname('ALICE').nicknameKey).toBe('alice');
    expect(normalizeNickname('小 王').nicknameKey).toBe('小 王');
  });
  it('accepts one through twenty characters', () => {
    expect(normalizeNickname('王').nickname).toBe('王');
    expect(normalizeNickname('王'.repeat(20)).nickname).toHaveLength(20);
  });
  it.each(['', ' \t\n ', '王'.repeat(21)])(
    'rejects invalid nickname %j',
    (value) => {
      expect(() => normalizeNickname(value)).toThrow();
    },
  );
});
