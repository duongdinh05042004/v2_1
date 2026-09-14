import { existsSync } from 'fs';
import { loadAppConfig } from './configuration';

export function isGoogleConfigured(): boolean {
  const google = loadAppConfig().google;
  if (!google.sheetId || google.sheetId === 'your-spreadsheet-id') {
    return false;
  }
  if (google.authMode === 'oauth2') {
    return Boolean(
      google.oauthClientId && google.oauthTokenFile && existsSync(google.oauthTokenFile),
    );
  }
  return Boolean(google.serviceAccountFile && existsSync(google.serviceAccountFile));
}

export function isBitrixConfigured(): boolean {
  const bitrix = loadAppConfig().bitrix;
  if (bitrix.authMode === 'oauth2') {
    return Boolean(bitrix.oauthDomain && (bitrix.oauthAccessToken || bitrix.oauthTokenFile));
  }
  return Boolean(bitrix.webhookUrl && bitrix.webhookUrl.startsWith('http'));
}

export function canUseLiveApis(): boolean {
  return isGoogleConfigured() && isBitrixConfigured();
}
