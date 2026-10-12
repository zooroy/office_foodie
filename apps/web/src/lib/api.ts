import type { ApiError } from '@office-foodie/shared';
import { credentialHeaders } from './identity';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: ApiError,
  ) {
    super(detail.message);
  }
}
export async function apiRequest<T>(
  path: string,
  options: RequestInit & { slug?: string } = {},
): Promise<T> {
  const { slug, ...init } = options;
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(credentialHeaders(slug)))
    headers.set(name, value);
  if (init.body && typeof init.body === 'string')
    headers.set('Content-Type', 'application/json');
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${path}`,
    { ...init, headers },
  );
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json();
  if (!response.ok)
    throw new ApiRequestError(response.status, data as ApiError);
  return data as T;
}
