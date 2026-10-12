'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { groupInputSchema } from '@office-foodie/shared';
import type { RestaurantDto, GroupCreatedDto } from '@office-foodie/shared';
import { apiRequest } from '@/lib/api';
import { saveCredential } from '@/lib/identity';
import { Button } from '@/components/ui/button';
export default function NewGroupPage() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]),
    [restaurantId, setRestaurantId] = useState(''),
    [created, setCreated] = useState<GroupCreatedDto | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    apiRequest<RestaurantDto[]>('/restaurants')
      .then(setRestaurants)
      .catch((e) => setError(e.message));
  }, []);
  async function addRestaurant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      const r = await apiRequest<RestaurantDto>('/restaurants', {
        method: 'POST',
        body: JSON.stringify({ name: data.get('name') }),
      });
      setRestaurants((current) => [r, ...current]);
      setRestaurantId(r.id);
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增失敗');
    } finally {
      setBusy(false);
    }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const deadline = data.get('deadlineAt') as string;
    const parsed = groupInputSchema.safeParse({
      title: data.get('title'),
      restaurantId,
      deadlineAt: deadline ? new Date(deadline).toISOString() : null,
      note: data.get('note') || null,
    });
    if (!parsed.success) {
      setError('請填寫標題並選擇餐廳');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<GroupCreatedDto>('/groups', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      saveCredential(result.slug, 'admin', result.adminSecret);
      setCreated(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '開團失敗');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <Link href="/" className="text-primary">
        ← 首頁
      </Link>
      <h1 className="text-2xl font-semibold">開一個新揪團</h1>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {created ? (
        <section className="space-y-4 rounded-xl border p-4">
          <h2 className="text-lg font-semibold">揪團已建立</h2>
          <p>目前為草稿，建立菜單並發布後，大家就能點餐。</p>
          <p className="rounded-lg bg-amber-50 p-3">
            請保存管理連結。管理憑證只會在建立時提供，換裝置時需要此連結。
          </p>
          <label className="block">
            分享連結
            <input
              readOnly
              value={`${window.location.origin}/g/${created.slug}`}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label className="block">
            管理連結
            <input
              readOnly
              value={`${window.location.origin}/g/${created.slug}/admin#${created.adminSecret}`}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <Link
            href={`/g/${created.slug}/admin#${created.adminSecret}`}
            className="block text-primary underline"
          >
            進入主揪管理
          </Link>
          <Link
            href={`/restaurants/${restaurantId}/menu`}
            className="block text-primary underline"
          >
            先編輯餐廳菜單
          </Link>
        </section>
      ) : (
        <>
          <form onSubmit={create} className="space-y-4 rounded-xl border p-4">
            <label className="block">
              餐廳
              <select
                aria-label="餐廳"
                required
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                className="mt-1 w-full rounded border p-2"
              >
                <option value="">請選擇餐廳</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              揪團標題
              <input
                name="title"
                required
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label className="block">
              截止時間（僅提醒，需手動結單）
              <input
                name="deadlineAt"
                type="datetime-local"
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label className="block">
              備註
              <textarea
                name="note"
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <Button type="submit" disabled={busy}>
              建立揪團
            </Button>
          </form>
          <section className="rounded-xl border p-4">
            <h2 className="mb-3 font-semibold">找不到餐廳？新增一家</h2>
            <form onSubmit={addRestaurant} className="flex gap-2">
              <input
                name="name"
                aria-label="新增餐廳名稱"
                required
                className="min-w-0 flex-1 rounded border p-2"
              />
              <Button type="submit" disabled={busy}>
                新增餐廳
              </Button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
