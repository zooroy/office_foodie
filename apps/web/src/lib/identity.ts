type CredentialKind = 'participant' | 'admin';
const memory = new Map<string, string>();
function key(slug: string, kind: CredentialKind) {
  return `office-foodie:${slug}:${kind}`;
}
export function saveCredential(
  slug: string,
  kind: CredentialKind,
  value: string,
): void {
  const storageKey = key(slug, kind);
  memory.set(storageKey, value);
  try {
    window.localStorage.setItem(storageKey, value);
  } catch {
    /* Retain identity for this page when storage is unavailable. */
  }
}
export function readCredential(
  slug: string,
  kind: CredentialKind,
): string | null {
  const storageKey = key(slug, kind);
  try {
    return (
      window.localStorage.getItem(storageKey) ?? memory.get(storageKey) ?? null
    );
  } catch {
    return memory.get(storageKey) ?? null;
  }
}
export function captureAdminSecret(slug: string): string | null {
  if (typeof window === 'undefined') return null;
  const fragment = window.location.hash.slice(1);
  if (fragment) {
    try {
      const secret = decodeURIComponent(fragment);
      saveCredential(slug, 'admin', secret);
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    } catch {
      /* Ignore malformed fragments. */
    }
  }
  return readCredential(slug, 'admin');
}
export function credentialHeaders(slug?: string): Record<string, string> {
  if (!slug) return {};
  const headers: Record<string, string> = {};
  const token = readCredential(slug, 'participant');
  const secret = readCredential(slug, 'admin');
  if (token) headers['X-Participant-Token'] = token;
  if (secret) headers['X-Admin-Secret'] = secret;
  return headers;
}
