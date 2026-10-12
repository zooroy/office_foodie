'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import type {
  ParticipantDto,
  ParticipantJoinedDto,
} from '@office-foodie/shared';
import { apiRequest } from '@/lib/api';
import { readCredential, saveCredential } from '@/lib/identity';
import { Button } from '@/components/ui/button';
import { useGroup } from '@/lib/use-group';
import { OrderEditor } from '@/components/order-editor';
export default function OrderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { group, refresh, error: queryError } = useGroup(slug);
  const [meId, setMeId] = useState<string | null>(null),
    [error, setError] = useState(''),
    [joining, setJoining] = useState(false);
  useEffect(() => {
    if (readCredential(slug, 'participant'))
      apiRequest<ParticipantDto>(`/groups/${slug}/me`, { slug })
        .then((me) => setMeId(me.id))
        .catch((e) => setError(e.message));
  }, [slug]);
  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setJoining(true);
    setError('');
    try {
      const result = await apiRequest<ParticipantJoinedDto>(
        `/groups/${slug}/participants`,
        {
          method: 'POST',
          body: JSON.stringify({ nickname: data.get('nickname') }),
        },
      );
      saveCredential(slug, 'participant', result.participantToken);
      setMeId(result.participant.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入失敗');
    } finally {
      setJoining(false);
    }
  }
  if (!group) return <main className="p-4">{error || queryError || '載入中…'}</main>;
  const me = group.participants.find((p) => p.id === meId);
  const subtotal =
    me?.orders.reduce((sum, o) => sum + o.unitPriceSnapshot * o.quantity, 0) ??
    0;
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <Link href="/" className="text-primary">
        ← 首頁
      </Link>
      <h1 className="break-words text-2xl font-semibold">{group.title}</h1>
      <p>{group.restaurant.name}</p>
      {group.note && <p className="break-words">{group.note}</p>}
      {group.deadlineAt && (
        <p className="text-sm">
          截止時間：{new Date(group.deadlineAt).toLocaleString('zh-TW')}
          {new Date(group.deadlineAt).getTime() < Date.now() &&
          group.status === 'OPEN'
            ? '（已過截止時間，主揪尚未結單，仍可點餐）'
            : ''}
        </p>
      )}
      {group.status !== 'OPEN' && (
        <p role="status" className="rounded bg-amber-50 p-3">
          目前未開放點餐或已結單。
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {me ? (
        <OrderEditor
          group={group}
          participant={me}
          canEdit={group.status === 'OPEN'}
          onChanged={refresh}
        />
      ) : (
        <form onSubmit={join} className="space-y-3 rounded-xl border p-4">
          <label className="block">
            你的暱稱
            <input
              name="nickname"
              required
              maxLength={20}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <Button type="submit" disabled={joining}>
            加入揪團
          </Button>
        </form>
      )}
      {me &&
        me.orders.length > 0 &&
        ['CLOSED', 'ORDERED', 'SETTLED'].includes(group.status) && (
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="font-semibold">我的付款</h2>
            <p>
              應付：{subtotal + me.adjustment} 元（調整額 {me.adjustment} 元）
            </p>
            <p>
              {me.paymentStatus === 'CONFIRMED'
                ? '主揪已確認收款'
                : me.paymentStatus === 'REPORTED'
                  ? '已回報，等待主揪確認'
                  : '尚未付款'}
            </p>
            {group.status !== 'SETTLED' && me.paymentStatus !== 'CONFIRMED' && (
              <Button
                onClick={async () => {
                  try {
                    await apiRequest(`/participants/${me.id}/payment`, {
                      slug,
                      method: 'PATCH',
                      body: JSON.stringify({
                        paymentStatus:
                          me.paymentStatus === 'REPORTED'
                            ? 'UNPAID'
                            : 'REPORTED',
                      }),
                    });
                    await refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '回報失敗');
                  }
                }}
              >
                {me.paymentStatus === 'REPORTED' ? '撤回付款回報' : '我已付款'}
              </Button>
            )}
          </section>
        )}
      <section aria-label="全團點餐" className="space-y-3">
        <h2 className="text-lg font-semibold">全團點餐</h2>
        {group.participants.map((p) => (
          <article key={p.id} className="rounded-xl border p-3">
            <h3 className="font-medium">{p.nickname}</h3>
            {p.orders.map((o) => (
              <p key={o.id} className="break-words">
                {o.nameSnapshot} ×{o.quantity} ·{' '}
                {o.unitPriceSnapshot * o.quantity} 元{o.note && `（${o.note}）`}
              </p>
            ))}
            {!p.orders.length && (
              <p className="text-sm text-muted-foreground">尚未點餐</p>
            )}
          </article>
        ))}
      </section>
      {me && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4 text-center font-medium shadow">
          我的餐點小計：{subtotal} 元
        </div>
      )}
    </main>
  );
}
