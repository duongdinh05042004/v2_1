import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { Auth, google } from 'googleapis';
import { JWT, OAuth2Client } from 'google-auth-library';
import { loadAppConfig } from '../core/configuration';
import { AppConfig } from '../core/types';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly config: AppConfig['google'];

  constructor() {
    this.config = loadAppConfig().google;
  }

  async getClient(): Promise<JWT | OAuth2Client> {
    if (this.config.authMode === 'oauth2') {
      return this.getOAuthClient();
    }
    return this.getServiceAccountClient();
  }

  getSheetsApi() {
    return google.sheets({ version: 'v4' });
  }

  getAuthUrl(): string {
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });
  }

  async exchangeCode(code: string): Promise<void> {
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    this.persistToken(tokens);
  }

  private getServiceAccountClient(): JWT {
    const file = this.config.serviceAccountFile;
    if (!file) {
      throw new Error('Thiếu GOOGLE_SERVICE_ACCOUNT_FILE cho chế độ service_account');
    }
    if (!existsSync(file)) {
      throw new Error(`Không tìm thấy service account: ${file}`);
    }
    const raw = JSON.parse(readFileSync(file, 'utf8')) as {
      client_email: string;
      private_key: string;
    };
    this.logger.log(`Google auth: service account ${raw.client_email}`);
    return new JWT({
      email: raw.client_email,
      key: raw.private_key,
      scopes: SCOPES,
    });
  }

  private getOAuthClient(): OAuth2Client {
    const client = this.createOAuthClient();
    const file = this.config.oauthTokenFile;
    if (!file || !existsSync(file)) {
      throw new Error(
        'Chưa có OAuth token. Mở /auth/google rồi hoàn tất consent, hoặc chạy lại sau khi lưu token.',
      );
    }
    const tokens = JSON.parse(readFileSync(file, 'utf8')) as Auth.Credentials;
    client.setCredentials(tokens);
    client.on('tokens', (next) => this.persistToken({ ...tokens, ...next }));
    return client;
  }

  private createOAuthClient(): OAuth2Client {
    if (!this.config.oauthClientId || !this.config.oauthClientSecret) {
      throw new Error('Thiếu GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET');
    }
    return new google.auth.OAuth2(
      this.config.oauthClientId,
      this.config.oauthClientSecret,
      this.config.oauthRedirectUri,
    );
  }

  private persistToken(tokens: Auth.Credentials): void {
    const file = this.config.oauthTokenFile;
    if (!file) {
      return;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(tokens, null, 2), 'utf8');
    this.logger.log('Đã lưu Google OAuth token');
  }
}
