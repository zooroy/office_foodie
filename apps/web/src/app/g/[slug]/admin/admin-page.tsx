'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import type { GroupStatus, RestaurantDto } from '@office-foodie/shared';
import { apiRequest } from '@/lib/api';
import { captureAdminSecret } from '@/lib/identity';
import { Button } from '@/components/ui/button';
import { useGroup } from '@/lib/use-group';
import { AdminOrders } from '@/components/admin-orders';
import { GroupSummary } from '@/components/group-summary';
const statusLabels: Record<GroupStatus, string> = {
  DRAFT: '草稿',
  OPEN: '開放',
  CLOSED: '已結單',
  ORDERED: '已訂購',
  SETTLED: '已結案',
  CANCELLED: '已取消',
};
const actions: Partial<Record<GroupStatus, GroupStatus>> = {
  DRAFT: 'OPEN',
  OPEN: 'CLOSED',
  CLOSED: 'ORDERED',
  ORDERED: 'SETTLED',
};
const actionLabels: Partial<Record<GroupStatus, string>> = {
  OPEN: '發布揪團',
  CLOSED: '結單',
  ORDERED: '標記已訂購',
  SETTLED: '結案',
  CANCELLED: '取消揪團',
};
export default function AdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const { group, setGroup, error: queryError } = useGroup(slug);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [origin, setOrigin] = useState('');
  useEffect(() => {
    const secret = captureAdminSecret(slug);
    Promise.resolve().then(() => {
      setOrigin(window.location.origin);
      if (!secret) setError('請使用建立揪團時的管理連結取得權限');
    });
    apiRequest<RestaurantDto[]>('/restaurants')
      .then(setRestaurants)
      .catch((e) => setError(e.message));
  }, [slug]);
  async function change(to: GroupStatus) {
    if (!window.confirm(`確定${actionLabels[to]}？`)) return;
    setBusy(true);
    setError('');
    try {
      setGroup(
        await apiRequest(`/groups/${slug}/transitions`, {
          slug,
          method: 'POST',
          body: JSON.stringify({ to }),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusy(false);
    }
  }
  async function edit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const deadline = data.get('deadlineAt') as string;
    setBusy(true);
    setError('');
    try {
      setGroup(
        await apiRequest(`/groups/${slug}`, {
          slug,
          method: 'PATCH',
          body: JSON.stringify({
            title: data.get('title'),
            ...(group?.status === 'DRAFT'
              ? { restaurantId: data.get('restaurantId') }
              : {}),
            note: data.get('note') || null,
            deadlineAt: deadline ? new Date(deadline).toISOString() : null,
          }),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setBusy(false);
    }
  }
  if (!group) return <main className="p-4">{error || queryError || '載入中…'}</main>;
  const final = group.status === 'SETTLED' || group.status === 'CANCELLED';
  const next = actions[group.status];
  const deadline = group.deadlineAt
    ? new Date(
        new Date(group.deadlineAt).getTime() -
          new Date(group.deadlineAt).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : '';
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pb-12">
      <Link href="/" className="text-primary">
        ← 首頁
      </Link>
      <h1 className="break-words text-2xl font-semibold">
        {group.title}・主揪管理
      </h1>
      <p>狀態：{statusLabels[group.status]}</p>
      <GroupSummary group={group} />
      <AdminOrders
        group={group}
        onChanged={async () => {
          setGroup(await apiRequest(`/groups/${slug}`));
        }}
      />
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {next && (
          <Button disabled={busy} onClick={() => void change(next)}>
            {actionLabels[next]}
          </Button>
        )}
        {['DRAFT', 'OPEN', 'CLOSED'].includes(group.status) && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void change('CANCELLED')}
          >
            取消揪團
          </Button>
        )}
      </div>
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">分享給同事</h2>
        <Link href={`/g/${slug}`} className="break-all text-primary underline">
          {origin}/g/{slug}
        </Link>
        {origin && (
          <QRCodeSVG
            value={`${origin}/g/${slug}`}
            size={160}
            title="揪團分享 QR code"
          />
        )}
        <Link
          href={`/restaurants/${group.restaurantId}/menu`}
          className="block text-primary underline"
        >
          編輯餐廳菜單
        </Link>
      </section>
      {!final && (
        <form
          key={`${group.title}:${group.note}:${group.deadlineAt}`}
          onSubmit={edit}
          className="space-y-3 rounded-xl border p-4"
        >
          <h2 className="font-semibold">編輯揪團資訊</h2>
          {group.status === 'DRAFT' && (
            <label className="block">
              餐廳
              <select
                name="restaurantId"
                defaultValue={group.restaurantId}
                className="mt-1 w-full rounded border p-2"
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            標題
            <input
              name="title"
              defaultValue={group.title}
              required
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label className="block">
            截止時間
            <input
              name="deadlineAt"
              type="datetime-local"
              defaultValue={deadline}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label className="block">
            備註
            <textarea
              name="note"
              defaultValue={group.note ?? ''}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <Button type="submit" disabled={busy}>
            儲存揪團資訊
          </Button>
        </form>
      )}
    </main>
  );
}
