'use client';
import { useState } from 'react';
import type { GroupSnapshot, PaymentStatus } from '@office-foodie/shared';
import { apiRequest } from '@/lib/api';
import { Button } from './ui/button';
export function GroupSummary({ group }: { group: GroupSnapshot }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const people = group.participants
    .filter((p) => p.orders.length > 0)
    .map((p) => ({
      ...p,
      amount: p.orders.reduce(
        (sum, o) => sum + o.quantity * o.unitPriceSnapshot,
        p.adjustment,
      ),
    }));
  const items = new Map<
    string,
    { name: string; price: number; quantity: number; notes: string[] }
  >();
  for (const person of people)
    for (const order of person.orders) {
      const key = JSON.stringify([order.nameSnapshot, order.unitPriceSnapshot]);
      const item = items.get(key) ?? {
        name: order.nameSnapshot,
        price: order.unitPriceSnapshot,
        quantity: 0,
        notes: [],
      };
      item.quantity += order.quantity;
      if (order.note) item.notes.push(order.note);
      items.set(key, item);
    }
  const total = people.reduce((sum, p) => sum + p.amount, 0);
  const paid = people
    .filter((p) => p.paymentStatus === 'CONFIRMED')
    .reduce((sum, p) => sum + p.amount, 0);
  const final = ['SETTLED', 'CANCELLED'].includes(group.status);
  async function change(
    id: string,
    kind: 'adjustment' | 'payment',
    value: number | PaymentStatus,
  ) {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest(`/participants/${id}/${kind}`, {
        slug: group.slug,
        method: 'PATCH',
        body: JSON.stringify(
          kind === 'adjustment'
            ? { adjustment: value }
            : { paymentStatus: value },
        ),
      });
      setMessage('已更新');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '更新失敗');
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    const text = [...items.values()]
      .map(
        (item) =>
          `${item.name} ×${item.quantity}，小計 ${item.price * item.quantity} 元${item.notes.length ? `（${item.notes.join('；')}）` : ''}`,
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(
        `${group.title}\n${text}\n餐點總額：${[...items.values()].reduce((sum, item) => sum + item.price * item.quantity, 0)} 元`,
      );
      setMessage('已複製彙總');
    } catch {
      setMessage('無法存取剪貼簿，請選取彙總文字複製');
    }
  }
  return (
    <section aria-label="點餐統計" className="space-y-4 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">點餐統計與收款</h2>
      <p>
        應收 {total} 元 · 已收 {paid} 元 · 未收 {total - paid} 元
      </p>
      {[...items.entries()].map(([key, item]) => (
        <p key={key} className="break-words">
          {item.name} ×{item.quantity}，小計 {item.quantity * item.price} 元
          {item.notes.length > 0 && `（${item.notes.join('；')}）`}
        </p>
      ))}
      <Button variant="outline" onClick={() => void copy()}>
        複製彙總文字
      </Button>
      {people.map((person) => (
        <article key={person.id} className="space-y-2 rounded border p-3">
          <h3>
            {person.nickname} · 應付 {person.amount} 元
          </h3>
          {person.orders.map((order) => (
            <p key={order.id}>
              {order.nameSnapshot} ×{order.quantity} ·{' '}
              {order.unitPriceSnapshot * order.quantity} 元
            </p>
          ))}
          <form
            key={person.adjustment}
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void change(
                person.id,
                'adjustment',
                Number(new FormData(event.currentTarget).get('adjustment')),
              );
            }}
          >
            <label>
              調整額
              <input
                name="adjustment"
                aria-label={`${person.nickname}調整額`}
                type="number"
                step="1"
                required
                defaultValue={person.adjustment}
                disabled={final || busy}
                className="block w-28 rounded border p-2"
              />
            </label>
            <Button type="submit" disabled={final || busy}>
              儲存調整額
            </Button>
          </form>
          <label>
            付款狀態
            <select
              aria-label={`${person.nickname}付款狀態`}
              value={person.paymentStatus}
              disabled={busy || !['CLOSED', 'ORDERED'].includes(group.status)}
              onChange={(event) =>
                void change(
                  person.id,
                  'payment',
                  event.target.value as PaymentStatus,
                )
              }
              className="ml-2 rounded border p-2"
            >
              <option value="UNPAID">未付</option>
              <option value="REPORTED">已回報，待確認</option>
              <option value="CONFIRMED">已確認</option>
            </select>
          </label>
        </article>
      ))}
      {people.some((p) => p.paymentStatus !== 'CONFIRMED') && (
        <p>
          尚未確認：
          {people
            .filter((p) => p.paymentStatus !== 'CONFIRMED')
            .map((p) => `${p.nickname} ${p.amount} 元`)
            .join('、')}
        </p>
      )}
      {people.length > 0 &&
        people.every((p) => p.paymentStatus === 'CONFIRMED') && (
          <p role="status">款項已全部收齊，可以結案。</p>
        )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
