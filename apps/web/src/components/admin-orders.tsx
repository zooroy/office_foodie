'use client';
import { useState } from 'react';
import type { GroupSnapshot } from '@office-foodie/shared';
import { OrderEditor } from './order-editor';
export function AdminOrders({
  group,
  onChanged,
}: {
  group: GroupSnapshot;
  onChanged: () => Promise<void>;
}) {
  const [id, setId] = useState('');
  const participant = group.participants.find((p) => p.id === id);
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">代改參與者點餐</h2>
      <select
        aria-label="選擇代改參與者"
        value={id}
        onChange={(e) => setId(e.target.value)}
        className="w-full rounded border p-2"
      >
        <option value="">請選擇參與者</option>
        {group.participants.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nickname}
          </option>
        ))}
      </select>
      {!group.participants.length && (
        <p className="text-muted-foreground">尚未有人加入揪團。</p>
      )}
      {participant && (
        <OrderEditor
          group={group}
          participant={participant}
          canEdit={!['SETTLED', 'CANCELLED'].includes(group.status)}
          onChanged={onChanged}
        />
      )}
    </section>
  );
}
