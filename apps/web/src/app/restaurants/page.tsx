'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { restaurantInputSchema } from '@office-foodie/shared';
import type { RestaurantDto } from '@office-foodie/shared';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    apiRequest<RestaurantDto[]>('/restaurants')
      .then((data) => {
        if (active) {
          setRestaurants(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setRestaurants(
        await apiRequest(`/restaurants?q=${encodeURIComponent(query)}`),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '搜尋失敗');
    } finally {
      setBusy(false);
    }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const parsed = restaurantInputSchema.safeParse(Object.fromEntries(values));
    if (!parsed.success) {
      setError('請填寫餐廳名稱');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest('/restaurants', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      setRestaurants(await apiRequest('/restaurants'));
      setQuery('');
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增失敗');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pb-12">
      <Link href="/" className="text-sm text-primary">
        ← 首頁
      </Link>
      <h1 className="text-2xl font-semibold">餐廳與菜單</h1>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      <form onSubmit={search} className="flex gap-2">
        <input
          aria-label="搜尋餐廳"
          className="min-w-0 flex-1 rounded-lg border p-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="輸入餐廳名稱"
        />
        <Button type="submit" disabled={busy}>
          搜尋
        </Button>
      </form>
      {loading ? (
        <p>載入中…</p>
      ) : (
        <section aria-label="餐廳列表" className="space-y-3">
          {restaurants.length ? (
            restaurants.map((r) => (
              <Link
                key={r.id}
                href={`/restaurants/${r.id}/menu`}
                className="block rounded-xl border p-4"
              >
                <h2 className="break-words font-medium">{r.name}</h2>
                <p className="break-words text-sm text-muted-foreground">
                  {r.phone || '尚未填寫電話'} · 編輯菜單 →
                </p>
              </Link>
            ))
          ) : (
            <p className="text-muted-foreground">
              沒有符合的餐廳，可以新增一家。
            </p>
          )}
        </section>
      )}
      <section className="rounded-xl border p-4">
        <h2 className="mb-4 text-lg font-semibold">新增餐廳</h2>
        <form onSubmit={create} className="space-y-3">
          {[
            ['name', '餐廳名稱'],
            ['phone', '電話'],
            ['address', '地址'],
          ].map(([name, label]) => (
            <label key={name} className="block text-sm">
              {label}
              <input
                name={name}
                required={name === 'name'}
                className="mt-1 block w-full rounded-lg border p-2"
              />
            </label>
          ))}
          <Button type="submit" disabled={busy}>
            新增餐廳
          </Button>
        </form>
      </section>
    </main>
  );
}
