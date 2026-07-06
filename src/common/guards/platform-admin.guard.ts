import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AppError } from '../errors/app-error';

interface RequestUser {
  isPlatformAdmin?: boolean;
}

/**
 * Restringe rotas de administração da plataforma (ex.: gestão de planos).
 * Roda após o JwtAuthGuard, que injeta request.user. Config global da
 * plataforma — não é escopo de tenant.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as RequestUser | undefined;

    if (!user?.isPlatformAdmin) {
      throw new AppError('PLATFORM_ADMIN_REQUIRED', 403);
    }

    return true;
  }
}
