import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppError } from '../errors/app-error';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthPayload } from '../types/auth-payload';
import {
  IUserLoaderById,
  USER_LOADER_TOKEN,
} from '../contracts/user-loader-by-id.contract';

/**
 * Guard B2C: exige JWT válido + usuário ativo. Sem multi-tenant.
 * O escopo por usuário (ownership) é aplicado nos use-cases via `request.user.id`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @Inject(USER_LOADER_TOKEN) private readonly userLoader: IUserLoaderById,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new AppError('UNAUTHORIZED', 401);
    }

    let payload: AuthPayload;
    try {
      payload = await this.jwtService.verifyAsync<AuthPayload>(token);
    } catch (err: any) {
      if (err?.name === 'TokenExpiredError') {
        throw new AppError('TOKEN_EXPIRED', 401);
      }
      throw new AppError('INVALID_TOKEN', 401);
    }

    const user = await this.userLoader.execute(payload.sub);

    if (!user || !user.isActive) {
      throw new AppError('UNAUTHORIZED', 401);
    }

    request['user'] = user;

    return true;
  }

  private extractToken(request: Request): string | null {
    const auth = request.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }
}
