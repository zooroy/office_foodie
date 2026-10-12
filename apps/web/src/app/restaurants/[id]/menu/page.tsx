import { Suspense } from 'react';
import MenuEditor from './menu-editor';

export default function MenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<main className="mx-auto max-w-3xl p-4">載入菜單中…</main>}
    >
      <MenuEditor params={params} />
    </Suspense>
  );
}
