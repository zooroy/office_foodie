import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
@Injectable()
export class ExtractionUsageService {
  constructor(private readonly prisma: PrismaService) {}
  async consume(ip: string) {
    const day = new Date().toISOString().slice(0, 10);
    const date = new Date(`${day}T00:00:00Z`);
    const ipLimit = Number(process.env.EXTRACTION_IP_DAILY_LIMIT ?? 5);
    const globalLimit = Number(
      process.env.EXTRACTION_GLOBAL_DAILY_LIMIT ?? 100,
    );
    if (
      !Number.isInteger(ipLimit) ||
      ipLimit < 1 ||
      !Number.isInteger(globalLimit) ||
      globalLimit < 1
    )
      throw new Error('Extraction limits must be positive integers');
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`menu-extraction:${day}`}))`;
      const usage = await tx.extractionUsage.findUnique({
        where: { ip_date: { ip, date } },
      });
      const global = await tx.extractionUsage.aggregate({
        where: { date },
        _sum: { count: true },
      });
      if (
        (usage?.count ?? 0) >= ipLimit ||
        (global._sum.count ?? 0) >= globalLimit
      )
        throw new HttpException(
          {
            code: 'EXTRACTION_LIMIT',
            message: '已達今日辨識上限，請改為手動輸入',
          },
          429,
        );
      await tx.extractionUsage.upsert({
        where: { ip_date: { ip, date } },
        create: { ip, date, count: 1 },
        update: { count: { increment: 1 } },
      });
    });
  }
}
