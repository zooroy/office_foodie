'use client';
import { useEffect, useState } from 'react';
import type { GroupSnapshot } from '@office-foodie/shared';
import { DEMO_SLUG, DEMO_ADMIN_SECRET } from '@office-foodie/shared';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';

export default function Home() {
  const [groups, setGroups] = useState<GroupSnapshot[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    apiRequest<GroupSnapshot[]>('/groups?status=OPEN')
      .then(setGroups)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <p className="text-sm font-medium text-primary">Office Foodie</p>
      <h1 className="text-3xl font-bold tracking-tight">
        一起訂午餐，輕鬆揪一團
      </h1>
      <p className="text-muted-foreground">
        辦公室揪團點餐，從菜單到收款一次整理。
      </p>
      <div>
        <Link
          href="/groups/new"
          className="inline-block rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        >
          開團
        </Link>
        <Link href="/restaurants" className="ml-4 text-primary underline">
          餐廳與菜單
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <section aria-label="開放中的揪團" className="space-y-3">
        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
          <div className="space-y-2 rounded-xl bg-accent p-4">
            <Link
              href={`/g/${DEMO_SLUG}/admin#${DEMO_ADMIN_SECRET}`}
              className="text-primary underline"
            >
              以主揪身份體驗
            </Link>
            <p>開兩個視窗試試看：一個管理揪團，一個觀看點餐即時更新。</p>
            <p className="text-sm">示範資料會每日重置。</p>
          </div>
        )}
        <h2 className="text-xl font-semibold">開放中的揪團</h2>
        {groups.length ? (
          groups.map((group) => (
            <Link
              href={`/g/${group.slug}`}
              key={group.slug}
              className="block rounded-xl border p-4"
            >
              <h3 className="break-words font-medium">{group.title}</h3>
              <p>{group.restaurant.name}</p>
              <p className="text-sm text-muted-foreground">
                {group.participants.filter((p) => p.orders.length).length}{' '}
                人已點餐 ·{' '}
                {group.deadlineAt
                  ? `截止 ${new Date(group.deadlineAt).toLocaleString('zh-TW')}`
                  : '未設定截止時間'}
              </p>
            </Link>
          ))
        ) : (
          <p className="text-muted-foreground">
            目前沒有開放中的揪團，來開第一團吧。
          </p>
        )}
      </section>
    </main>
  );
}
