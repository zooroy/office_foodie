import type { PrismaClient } from '@prisma/client';
import { hashCredential } from '../identity/credentials.js';
import { DEMO_SLUG, DEMO_ADMIN_SECRET } from '@office-foodie/shared';
export { DEMO_SLUG, DEMO_ADMIN_SECRET };
export async function seedDemo(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('office-foodie-demo-seed'))`;
    const restaurants = [
      {
        name: '好食便當',
        items: [
          ['排骨飯', 100],
          ['雞腿飯', 120],
          ['滷蛋', 15],
        ],
      },
      {
        name: '巷口麵館',
        items: [
          ['牛肉麵', 160],
          ['乾麵', 60],
          ['燙青菜', 40],
        ],
      },
      {
        name: '午後茶飲',
        items: [
          ['紅茶', 30],
          ['珍珠奶茶', 60],
          ['水果茶', 70],
        ],
      },
    ];
    for (let r = 0; r < restaurants.length; r++) {
      const restaurant = restaurants[r]!;
      const id = `demo-restaurant-${r}`;
      await tx.restaurant.upsert({
        where: { id },
        update: { name: restaurant.name },
        create: {
          id,
          name: restaurant.name,
          phone: '02-2345-6789',
          address: '台北市辦公室附近',
        },
      });
      for (let i = 0; i < restaurant.items.length; i++) {
        const [name, price] = restaurant.items[i]!;
        const item = {
          restaurantId: id,
          name: String(name),
          price: Number(price),
          category: r === 2 ? '飲料' : i === 2 ? '配菜' : '主餐',
          sortOrder: i,
          deletedAt: null,
        };
        await tx.menuItem.upsert({
          where: { id: `demo-item-${r}-${i}` },
          update: item,
          create: { id: `demo-item-${r}-${i}`, ...item },
        });
      }
    }
    for (const [index, slug] of [DEMO_SLUG, 'demo-closed'].entries()) {
      const data = {
        title: index === 0 ? '今天一起訂便當' : '昨天的午餐收款',
        restaurantId: 'demo-restaurant-0',
        status: index === 0 ? ('OPEN' as const) : ('CLOSED' as const),
        adminSecretHash: hashCredential(DEMO_ADMIN_SECRET),
        isDemo: true,
        note: '示範資料會每日重置，歡迎體驗。',
        deadlineAt: null,
      };
      const group = await tx.group.upsert({
        where: { slug },
        update: data,
        create: { slug, ...data },
      });
      await tx.participant.deleteMany({ where: { groupId: group.id } });
      for (const [i, nickname] of [
        '小王',
        '阿明',
        '小李',
        '怡君',
        '志豪',
      ].entries()) {
        const item = await tx.menuItem.findUniqueOrThrow({
          where: { id: `demo-item-0-${i % 2}` },
        });
        await tx.participant.create({
          data: {
            groupId: group.id,
            nickname,
            nicknameKey: nickname,
            tokenHash: hashCredential(`demo-${slug}-${i}`),
            paymentStatus:
              index === 1 && i < 2
                ? 'CONFIRMED'
                : index === 1 && i === 2
                  ? 'REPORTED'
                  : 'UNPAID',
            orders: {
              create: {
                menuItemId: item.id,
                nameSnapshot: item.name,
                unitPriceSnapshot: item.price,
                quantity: 1,
                note: i === 0 ? '飯少' : null,
              },
            },
          },
        });
      }
    }
  });
}
