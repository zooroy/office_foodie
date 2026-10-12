import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { ExtractionUsageService } from './extraction-usage.service.js';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MENU_EXTRACTOR } from './menu-extractor.js';
import type { MenuExtractor } from './menu-extractor.js';

function imageMatchesMime(file: Express.Multer.File): boolean {
  const buffer = file.buffer;
  if (file.mimetype === 'image/jpeg')
    return (
      buffer.length >= 3 &&
      buffer[0] === 255 &&
      buffer[1] === 216 &&
      buffer[2] === 255
    );
  if (file.mimetype === 'image/png')
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === 'image/webp')
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  return false;
}
@Controller('menu-extractions')
export class ExtractionController {
  constructor(
    @Inject(MENU_EXTRACTOR) private readonly extractor: MenuExtractor,
    private readonly usage: ExtractionUsageService,
  ) {}
  @Post()
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 5 },
      fileFilter: (_request, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
          callback(
            new BadRequestException({
              code: 'INVALID_IMAGE',
              message: '只接受 JPEG、PNG 或 WebP，每張最多 5 MB',
            }),
            false,
          );
        else callback(null, true);
      },
    }),
  )
  async extract(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() request: Request,
  ) {
    if (
      !files?.length ||
      files.length > 5 ||
      files.some((file) => !imageMatchesMime(file))
    )
      throw new BadRequestException({
        code: 'INVALID_IMAGE',
        message: '請提供 1–5 張有效的 JPEG、PNG 或 WebP 圖片，每張最多 5 MB',
      });
    await this.usage.consume(
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
    return {
      items: await this.extractor.extract(
        files.map((file) => file.buffer),
        files.map((file) => file.mimetype),
      ),
    };
  }
}
