import { Suspense } from 'react';
import AdminPage from './admin-page';
export default function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-4">載入揪團中…</p>}>
      <AdminPage params={params} />
    </Suspense>
  );
}
