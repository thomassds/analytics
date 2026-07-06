import { ExecutionContext } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

const mockContext = (user: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('PlatformAdminGuard', () => {
  const guard = new PlatformAdminGuard();

  it('libera quando o usuário é platform admin', () => {
    expect(guard.canActivate(mockContext({ isPlatformAdmin: true }))).toBe(true);
  });

  it('bloqueia (403) quando o usuário não é platform admin', () => {
    expect(() =>
      guard.canActivate(mockContext({ isPlatformAdmin: false })),
    ).toThrow('PLATFORM_ADMIN_REQUIRED');
  });

  it('bloqueia (403) quando não há usuário no request', () => {
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      'PLATFORM_ADMIN_REQUIRED',
    );
  });
});
