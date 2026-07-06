import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IUserLoaderById } from '../contracts/user-loader-by-id.contract';
import { JwtAuthGuard } from './jwt-auth.guard';

const mockContext = (
  headers: Record<string, string>,
  handler = () => {},
  cls = class {},
) =>
  ({
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard (B2C)', () => {
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const userLoader = {
    execute: jest.fn(),
  } as unknown as IUserLoaderById;

  const guard = new JwtAuthGuard(jwtService, reflector, userLoader);

  beforeEach(() => {
    jest.clearAllMocks();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
  });

  it('allows public routes without token', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const ctx = mockContext({});

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('throws UNAUTHORIZED when Authorization header is absent', async () => {
    const ctx = mockContext({});

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  it('throws UNAUTHORIZED when Authorization header is malformed', async () => {
    const ctx = mockContext({ authorization: 'Token abc123' });

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  it('injects db user into request.user when token is valid', async () => {
    const payload = { sub: 'user-1', email: 'joao@email.com', name: 'Joao' };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);
    (userLoader.execute as jest.Mock).mockResolvedValue({
      id: 'user-1',
      name: 'Joao Silva',
      email: 'joao@email.com',
      isActive: true,
    });

    const request: any = { headers: { authorization: 'Bearer valid-token' } };
    const ctx = {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(userLoader.execute).toHaveBeenCalledWith('user-1');
    expect(request.user).toEqual({
      id: 'user-1',
      name: 'Joao Silva',
      email: 'joao@email.com',
      isActive: true,
    });
  });

  it('throws UNAUTHORIZED when user is not found in db', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'user-1',
      email: 'joao@email.com',
      name: 'Joao',
    });
    (userLoader.execute as jest.Mock).mockResolvedValue(null);

    const ctx = mockContext({ authorization: 'Bearer valid-token' });

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  it('throws UNAUTHORIZED when user is inactive', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'user-1',
      email: 'joao@email.com',
      name: 'Joao',
    });
    (userLoader.execute as jest.Mock).mockResolvedValue({
      id: 'user-1',
      name: 'Joao Silva',
      email: 'joao@email.com',
      isActive: false,
    });

    const ctx = mockContext({ authorization: 'Bearer valid-token' });

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  it('throws TOKEN_EXPIRED when jwt throws TokenExpiredError', async () => {
    const error = new Error('expired');
    error.name = 'TokenExpiredError';
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(error);

    const ctx = mockContext({ authorization: 'Bearer expired-token' });

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
      statusCode: 401,
    });
  });

  it('throws INVALID_TOKEN when jwt throws any other error', async () => {
    const error = new Error('invalid signature');
    error.name = 'JsonWebTokenError';
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(error);

    const ctx = mockContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      statusCode: 401,
    });
  });
});
