import { AppConfig } from './types';

function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function loadAppConfig(): AppConfig {
  return {
    port: envInt('PORT', 3000),
    nodeEnv: env('NODE_ENV', 'development'),
    adminApiToken: env('ADMIN_API_TOKEN') || undefined,
    mappingFile: env('MAPPING_FILE', './config/mapping.json'),
    syncStateFile: env('SYNC_STATE_FILE', './data/sync-state.json'),
    logDir: env('LOG_DIR', './logs'),
    google: {
      authMode: (env('GOOGLE_AUTH_MODE', 'service_account') as AppConfig['google']['authMode']),
      serviceAccountFile: env('GOOGLE_SERVICE_ACCOUNT_FILE') || undefined,
      oauthClientId: env('GOOGLE_OAUTH_CLIENT_ID') || undefined,
      oauthClientSecret: env('GOOGLE_OAUTH_CLIENT_SECRET') || undefined,
      oauthRedirectUri: env('GOOGLE_OAUTH_REDIRECT_URI') || undefined,
      oauthTokenFile: env('GOOGLE_OAUTH_TOKEN_FILE') || undefined,
      sheetId: env('GOOGLE_SHEET_ID'),
      worksheetName: env('GOOGLE_WORKSHEET_NAME', 'Leads'),
    },
    bitrix: {
      authMode: (env('BITRIX_AUTH_MODE', 'webhook') as AppConfig['bitrix']['authMode']),
      webhookUrl: env('BITRIX_WEBHOOK_URL') || undefined,
      oauthClientId: env('BITRIX_OAUTH_CLIENT_ID') || undefined,
      oauthClientSecret: env('BITRIX_OAUTH_CLIENT_SECRET') || undefined,
      oauthDomain: env('BITRIX_OAUTH_DOMAIN') || undefined,
      oauthAccessToken: env('BITRIX_OAUTH_ACCESS_TOKEN') || undefined,
      oauthRefreshToken: env('BITRIX_OAUTH_REFRESH_TOKEN') || undefined,
      oauthTokenFile: env('BITRIX_OAUTH_TOKEN_FILE', './credentials/bitrix-oauth-token.json') || undefined,
      batchSize: Math.min(envInt('BITRIX_BATCH_SIZE', 50), 50),
      batchPauseMs: envInt('BITRIX_BATCH_PAUSE_MS', 400),
    },
    sync: {
      direction: (env('SYNC_DIRECTION', 'one_way') as AppConfig['sync']['direction']),
      cron: env('SYNC_CRON', '*/15 * * * *'),
      conflictStrategy: (env('CONFLICT_STRATEGY', 'last_write_wins') as AppConfig['sync']['conflictStrategy']),
      dryRun: envBool('SYNC_DRY_RUN', false),
      retryMaxAttempts: envInt('RETRY_MAX_ATTEMPTS', 4),
      retryBaseDelayMs: envInt('RETRY_BASE_DELAY_MS', 500),
    },
  };
}
