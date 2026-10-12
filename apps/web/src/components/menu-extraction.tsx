'use client';
import { useState } from 'react';
import { menuBatchInputSchema } from '@office-foodie/shared';
import type { ExtractedItem } from '@office-foodie/shared';
import { apiRequest } from '@/lib/api';
import { Button } from './ui/button';

async function compressPhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('請選擇 JPEG、PNG 或 WebP 圖片');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('無法處理圖片，請改為手動輸入');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('圖片壓縮失敗'))),
        'image/jpeg',
        0.8,
      ),
    );
  } finally {
    bitmap.close();
  }
}
export function MenuExtraction({
  restaurantId,
  onSaved,
  onManual,
}: {
  restaurantId: string;
  onSaved: () => Promise<void>;
  onManual: () => void;
}) {
  const [items, setItems] = useState<ExtractedItem[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'extracting' | 'saving'>(
    'idle',
  );
  const [error, setError] = useState('');
  async function extract(files: File[]) {
    if (files.length < 1 || files.length > 5) {
      setError('一次請選擇 1–5 張照片');
      return;
    }
    setStatus('extracting');
    setError('');
    setItems(null);
    try {
      const data = new FormData();
      for (let i = 0; i < files.length; i++) {
        data.append('images', await compressPhoto(files[i]), `menu-${i}.jpg`);
      }
      const result = await apiRequest<{ items: ExtractedItem[] }>(
        '/menu-extractions',
        { method: 'POST', body: data },
      );
      if (!result.items.length)
        throw new Error('未辨識到品項，請重試或改為手動輸入');
      setItems(result.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '辨識失敗，請改為手動輸入');
    } finally {
      setStatus('idle');
    }
  }
  function edit(index: number, patch: Partial<ExtractedItem>) {
    setItems(
      (current) =>
        current?.map((item, i) =>
          i === index ? { ...item, ...patch } : item,
        ) ?? null,
    );
  }
  async function confirm() {
    const result = menuBatchInputSchema.safeParse({ items });
    if (!items?.length || !result.success) {
      setError('請確認每個品項都有品名與非負整數價格');
      return;
    }
    setStatus('saving');
    setError('');
    try {
      await apiRequest(`/restaurants/${restaurantId}/items`, {
        method: 'PUT',
        body: JSON.stringify(result.data),
      });
      await onSaved();
      setItems(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setStatus('idle');
    }
  }
  return (
    <section
      className="space-y-3 rounded-xl border p-4"
      aria-label="拍照辨識菜單"
    >
      <h2 className="text-lg font-semibold">拍照辨識菜單</h2>
      <p className="text-sm text-muted-foreground">
        選擇 1–5 張照片，辨識後請檢查品名與價格，確認才會加入菜單。
      </p>
      <label className="block text-sm">
        選擇菜單照片
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={status !== 'idle'}
          className="mt-2 block w-full min-w-0 text-sm"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void extract(files);
          }}
        />
      </label>
      <label className="block text-sm">
        拍攝菜單
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={status !== 'idle'}
          className="mt-2 block w-full min-w-0 text-sm"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void extract(files);
          }}
        />
      </label>
      {status === 'extracting' && <p role="status">辨識中，請稍候…</p>}
      {error && (
        <div
          role="alert"
          className="space-y-2 rounded-lg bg-red-50 p-3 text-red-700"
        >
          <p>{error}</p>
          <Button variant="outline" onClick={onManual}>
            改為手動輸入
          </Button>
        </div>
      )}
      {items && (
        <div className="space-y-3">
          <h3 className="font-medium">確認辨識結果</h3>
          {items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-lg border p-3">
              {item.needsReview && (
                <p className="text-sm text-amber-700">此品項需人工確認價格</p>
              )}
              <label className="block text-sm">
                品名
                <input
                  aria-label={`第 ${index + 1} 項品名`}
                  value={item.name}
                  onChange={(e) => edit(index, { name: e.target.value })}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label className="block text-sm">
                價格
                <input
                  aria-label={`第 ${index + 1} 項價格`}
                  type="number"
                  min="0"
                  step="1"
                  value={item.price ?? ''}
                  onChange={(e) =>
                    edit(index, {
                      price:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label className="block text-sm">
                分類
                <input
                  aria-label={`第 ${index + 1} 項分類`}
                  value={item.category ?? ''}
                  onChange={(e) =>
                    edit(index, { category: e.target.value || null })
                  }
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <Button
                variant="outline"
                disabled={status !== 'idle'}
                onClick={() =>
                  setItems(
                    (current) => current?.filter((_, i) => i !== index) ?? null,
                  )
                }
              >
                移除此項
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={status !== 'idle'}
              onClick={() =>
                setItems((current) => [
                  ...(current ?? []),
                  { name: '', price: null, category: null, needsReview: true },
                ])
              }
            >
              新增一項
            </Button>
            <Button disabled={status !== 'idle'} onClick={() => void confirm()}>
              {status === 'saving' ? '儲存中…' : '確認加入菜單'}
            </Button>
            <Button
              variant="outline"
              disabled={status !== 'idle'}
              onClick={() => {
                setItems(null);
                setError('');
              }}
            >
              取消辨識結果
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
