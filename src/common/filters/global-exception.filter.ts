import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AppError } from '../errors/app-error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppError) {
      return response.status(exception.statusCode).json({
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
        },
      });
    }

    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json({
        success: false,
        error: {
          code: 'HTTP_ERROR',
          message: exception.message,
        },
      });
    }

    console.error(exception);

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocorreu um erro inesperado.',
      },
    });
  }
}
