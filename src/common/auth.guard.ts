import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { loadAppConfig } from '../core/configuration';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = loadAppConfig().adminApiToken;
    if (!token) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const header = request.headers['x-admin-token'] || request.headers.authorization;
    const provided = header?.startsWith('Bearer ') ? header.slice(7) : header;
    if (provided !== token) {
      throw new UnauthorizedException('Thiếu hoặc sai ADMIN_API_TOKEN');
    }
    return true;
  }
}
