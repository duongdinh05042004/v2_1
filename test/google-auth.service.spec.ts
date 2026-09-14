import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { GoogleAuthService } from '../src/google/google-auth.service';

describe('GoogleAuthService', () => {
  it('service account thiếu file sẽ báo lỗi rõ', async () => {
    process.env.GOOGLE_AUTH_MODE = 'service_account';
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE = join(tmpdir(), 'missing-sa.json');
    const service = new GoogleAuthService();
    await expect(service.getClient()).rejects.toThrow(/Không tìm thấy service account/);
  });

  it('đọc service account hợp lệ', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sa-'));
    const file = join(dir, 'sa.json');
    writeFileSync(
      file,
      JSON.stringify({
        client_email: 'sync@project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n',
      }),
    );
    process.env.GOOGLE_AUTH_MODE = 'service_account';
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE = file;
    const service = new GoogleAuthService();
    const client = await service.getClient();
    expect(client).toBeDefined();
  });

  it('oauth thiếu client id', () => {
    process.env.GOOGLE_AUTH_MODE = 'oauth2';
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const service = new GoogleAuthService();
    expect(() => service.getAuthUrl()).toThrow(/GOOGLE_OAUTH_CLIENT_ID/);
  });
});
