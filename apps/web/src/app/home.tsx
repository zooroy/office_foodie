import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
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
        <Button size="lg">揪團點餐</Button>
        <Link href="/restaurants" className="ml-4 text-primary underline">
          餐廳與菜單
        </Link>
      </div>
    </main>
  );
}
