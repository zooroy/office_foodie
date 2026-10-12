'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { menuItemInputSchema } from '@office-foodie/shared';
import type { RestaurantDto, MenuItemDto } from '@office-foodie/shared';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Menu = RestaurantDto & { items: MenuItemDto[] };
export default function MenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [editing, setEditing] = useState<MenuItemDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    apiRequest<Menu>(`/restaurants/${id}`)
      .then((data) => {
        if (active) setMenu(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const parsed = menuItemInputSchema.safeParse({
      name: values.get('name'),
      price: Number(values.get('price')),
      category: values.get('category') || null,
    });
    if (!parsed.success) {
      setError('請填寫品名，價格必須為非負整數');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest(
        editing ? `/menu-items/${editing.id}` : `/restaurants/${id}/items`,
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(parsed.data),
        },
      );
      setMenu(await apiRequest(`/restaurants/${id}`));
      setEditing(null);
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: MenuItemDto) {
    if (!window.confirm(`確定刪除「${item.name}」？既有點餐會保留。`)) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/menu-items/${item.id}`, { method: 'DELETE' });
      setMenu(await apiRequest(`/restaurants/${id}`));
      if (editing?.id === item.id) setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '刪除失敗');
    } finally {
      setBusy(false);
    }
  }
  const categories = [
    ...new Set(menu?.items.map((item) => item.category || '未分類') ?? []),
  ];
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pb-12">
      <Link href="/restaurants" className="text-sm text-primary">
        ← 餐廳列表
      </Link>
      <h1 className="break-words text-2xl font-semibold">
        {menu?.name ?? '載入中…'}・菜單
      </h1>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {menu && (
        <section aria-label="菜單品項" className="space-y-4">
          {!menu.items.length && (
            <p className="text-muted-foreground">
              尚未建立菜單，請新增第一個品項。
            </p>
          )}
          {categories.map((category) => (
            <div key={category}>
              <h2 className="mb-2 break-words font-semibold">{category}</h2>
              <div className="space-y-2">
                {menu.items
                  .filter((item) => (item.category || '未分類') === category)
                  .map((item) => (
                    <article
                      key={item.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.price} 元
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => setEditing(item)}
                      >
                        編輯
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => remove(item)}
                      >
                        刪除
                      </Button>
                    </article>
                  ))}
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="rounded-xl border p-4">
        <h2 className="mb-4 text-lg font-semibold">
          {editing ? '編輯品項' : '新增品項'}
        </h2>
        <form key={editing?.id ?? 'new'} onSubmit={save} className="space-y-3">
          <label className="block text-sm">
            品名
            <input
              name="name"
              required
              defaultValue={editing?.name ?? ''}
              className="mt-1 block w-full rounded-lg border p-2"
            />
          </label>
          <label className="block text-sm">
            價格（元）
            <input
              name="price"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={editing?.price ?? ''}
              className="mt-1 block w-full rounded-lg border p-2"
            />
          </label>
          <label className="block text-sm">
            分類
            <input
              name="category"
              defaultValue={editing?.category ?? ''}
              className="mt-1 block w-full rounded-lg border p-2"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !menu}>
              儲存品項
            </Button>
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                取消編輯
              </Button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
