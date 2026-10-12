import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { nicknameSchema } from '@office-foodie/shared';

export function generateCredential(): string {
  return randomBytes(32).toString('base64url');
}
export function hashCredential(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function matchesCredential(
  value: string,
  expectedHash: string,
): boolean {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  return timingSafeEqual(
    Buffer.from(hashCredential(value), 'hex'),
    Buffer.from(expectedHash, 'hex'),
  );
}
export function normalizeNickname(value: string): {
  nickname: string;
  nicknameKey: string;
} {
  const nickname = nicknameSchema.parse(value);
  return { nickname, nicknameKey: nickname.toLowerCase() };
}
