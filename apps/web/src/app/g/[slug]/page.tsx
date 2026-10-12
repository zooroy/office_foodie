import { Suspense } from 'react';
import OrderPage from './order-page';
export default function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-4">載入揪團中…</p>}>
      <OrderPage params={params} />
    </Suspense>
  );
}
