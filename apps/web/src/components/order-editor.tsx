'use client';
import { useState } from 'react';
import type {
  GroupSnapshot,
  ParticipantDto,
  OrderItemDto,
} from '@office-foodie/shared';
import { apiRequest } from '@/lib/api';
import { Button } from './ui/button';

export function OrderEditor({
  group,
  participant,
  onChanged,
  canEdit,
}: {
  group: GroupSnapshot;
  participant: ParticipantDto;
  onChanged: () => Promise<void>;
  canEdit: boolean;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function add(
    event: React.FormEvent<HTMLFormElement>,
    menuItemId: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/groups/${group.slug}/orders`, {
        slug: group.slug,
        method: 'POST',
        body: JSON.stringify({
          menuItemId,
          participantId: participant.id,
          quantity: Number(data.get('quantity')),
          note: data.get('note') || null,
        }),
      });
      await onChanged();
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : '點餐失敗');
    } finally {
      setBusy(false);
    }
  }
  async function update(
    event: React.FormEvent<HTMLFormElement>,
    order: OrderItemDto,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/orders/${order.id}`, {
        slug: group.slug,
        method: 'PATCH',
        body: JSON.stringify({
          quantity: Number(data.get('quantity')),
          note: data.get('note') || null,
        }),
      });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失敗');
    } finally {
      setBusy(false);
    }
  }
  async function remove(order: OrderItemDto) {
    if (!window.confirm(`刪除「${order.nameSnapshot}」？`)) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/orders/${order.id}`, {
        slug: group.slug,
        method: 'DELETE',
      });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '刪除失敗');
    } finally {
      setBusy(false);
    }
  }
  const categories = [
    ...new Set(group.restaurant.items.map((item) => item.category || '未分類')),
  ];
  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      <section aria-label="我的點餐" className="space-y-3">
        <h2 className="text-lg font-semibold">{participant.nickname}的點餐</h2>
        {!participant.orders.length && (
          <p className="text-muted-foreground">還沒有點餐。</p>
        )}
        {participant.orders.map((order) => (
          <form
            key={`${order.id}:${order.quantity}:${order.note}`}
            onSubmit={(e) => void update(e, order)}
            className="space-y-2 rounded-xl border p-3"
          >
            <h3>
              {order.nameSnapshot} · {order.unitPriceSnapshot} 元
            </h3>
            <label className="block text-sm">
              數量
              <input
                aria-label={`${order.nameSnapshot}訂單數量`}
                name="quantity"
                type="number"
                min="1"
                max="99"
                step="1"
                required
                defaultValue={order.quantity}
                disabled={!canEdit || busy}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label className="block text-sm">
              備註
              <input
                aria-label={`${order.nameSnapshot}訂單備註`}
                name="note"
                maxLength={100}
                defaultValue={order.note ?? ''}
                disabled={!canEdit || busy}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <p>小計 {order.unitPriceSnapshot * order.quantity} 元</p>
            {canEdit && (
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  更新點餐
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void remove(order)}
                >
                  刪除點餐
                </Button>
              </div>
            )}
          </form>
        ))}
      </section>
      <section aria-label="可點菜單" className="space-y-4">
        <h2 className="text-lg font-semibold">菜單</h2>
        {categories.map((category) => (
          <div key={category} className="space-y-2">
            <h3 className="font-medium">{category}</h3>
            {group.restaurant.items
              .filter((item) => (item.category || '未分類') === category)
              .map((item) => (
                <form
                  key={item.id}
                  onSubmit={(e) => void add(e, item.id)}
                  className="space-y-2 rounded-xl border p-3"
                >
                  <h4 className="break-words">
                    {item.name} · {item.price} 元
                  </h4>
                  <label className="block text-sm">
                    數量
                    <input
                      aria-label={`${item.name}數量`}
                      name="quantity"
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      required
                      defaultValue={1}
                      disabled={!canEdit || busy}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label className="block text-sm">
                    備註
                    <input
                      aria-label={`${item.name}備註`}
                      name="note"
                      maxLength={100}
                      disabled={!canEdit || busy}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <Button type="submit" disabled={!canEdit || busy}>
                    加入點餐
                  </Button>
                </form>
              ))}
          </div>
        ))}
      </section>
    </div>
  );
}
