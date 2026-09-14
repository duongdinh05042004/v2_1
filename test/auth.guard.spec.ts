import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthGuard } from '../src/common/auth.guard';

describe('AdminAuthGuard', () => {
  const guard = new AdminAuthGuard();

  function ctx(headers: Record<string, string | undefined>) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as never;
  }

  it('cho qua khi không cấu hình token', () => {
    delete process.env.ADMIN_API_TOKEN;
    expect(guard.canActivate(ctx({}))).toBe(true);
  });

  it('chấp nhận x-admin-token hoặc Bearer', () => {
    process.env.ADMIN_API_TOKEN = 'secret';
    expect(guard.canActivate(ctx({ 'x-admin-token': 'secret' }))).toBe(true);
    expect(guard.canActivate(ctx({ authorization: 'Bearer secret' }))).toBe(true);
    expect(() => guard.canActivate(ctx({ authorization: 'Bearer wrong' }))).toThrow(
      UnauthorizedException,
    );
  });
});
