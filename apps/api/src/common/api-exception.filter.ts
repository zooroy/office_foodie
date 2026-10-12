import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const details =
      typeof body === 'object' && body !== null
        ? (body as { code?: string; message?: string | string[] })
        : undefined;
    if (status >= 500) this.logger.error(exception);
    response.status(status).json({
      code:
        details?.code ??
        (status === 404
          ? 'NOT_FOUND'
          : status >= 500
            ? 'INTERNAL_ERROR'
            : 'REQUEST_ERROR'),
      message:
        status >= 500
          ? '伺服器暫時無法處理請求'
          : (details?.message ?? body ?? '請求失敗'),
    });
  }
}
