'use client';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
export function BackendGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<
    'checking' | 'waking' | 'ready' | 'timeout'
  >('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    const wake = setTimeout(() => setState('waking'), 3000);
    const deadline = setTimeout(() => {
      stopped = true;
      controller?.abort();
      clearTimeout(retry);
      setState('timeout');
    }, 90000);
    async function check() {
      const startedAt = Date.now();
      controller = new AbortController();
      const abort = setTimeout(() => controller?.abort(), 3000);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/health`,
          { signal: controller.signal, cache: 'no-store' },
        );
        if (response.ok && !stopped) {
          stopped = true;
          clearTimeout(wake);
          clearTimeout(deadline);
          setState('ready');
        }
      } catch {
        /* Retry while the backend starts. */
      } finally {
        clearTimeout(abort);
        if (!stopped)
          retry = setTimeout(
            () => void check(),
            Math.max(0, 3000 - (Date.now() - startedAt)),
          );
      }
    }
    void check();
    return () => {
      stopped = true;
      controller?.abort();
      clearTimeout(wake);
      clearTimeout(deadline);
      clearTimeout(retry);
    };
  }, [attempt]);
  return (
    <>
      <div
        hidden={state !== 'ready'}
        key={state === 'ready' ? 'ready' : 'waiting'}
      >
        {children}
      </div>
      {state !== 'ready' && (
        <main
          className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6"
          aria-live="polite"
        >
          <h1 className="text-2xl font-semibold">
            {state === 'checking'
              ? '連線中…'
              : state === 'timeout'
                ? '暫時無法連線'
                : '伺服器喚醒中，約需 30 秒'}
          </h1>
          <p>
            {state === 'timeout'
              ? '請稍後再試一次。'
              : '就緒後會自動開啟你要查看的頁面。'}
          </p>
          {state === 'timeout' && (
            <Button
              onClick={() => {
                setState('checking');
                setAttempt((value) => value + 1);
              }}
            >
              重試
            </Button>
          )}
        </main>
      )}
    </>
  );
}
