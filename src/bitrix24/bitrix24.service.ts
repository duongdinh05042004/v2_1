import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { loadAppConfig } from '../core/configuration';
import { extractMessage, withRetry } from '../core/retry.util';
import { AppConfig, BitrixLead } from '../core/types';

interface BitrixResponse<T> {
  result: T;
  error?: string;
  error_description?: string;
  next?: number;
  total?: number;
}

export interface BatchCommand {
  key: string;
  method: string;
  params: Record<string, unknown>;
}

export interface BatchItemResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

export interface LeadMutation {
  type: 'add' | 'update';
  id?: string;
  fields: Record<string, unknown>;
}

export interface LeadMutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

interface StoredBitrixToken {
  access_token?: string;
  refresh_token?: string;
  expires?: number;
}

@Injectable()
export class Bitrix24Service {
  private readonly logger = new Logger(Bitrix24Service.name);
  private readonly config: AppConfig['bitrix'];
  private readonly retry: { maxAttempts: number; baseDelayMs: number };
  private readonly http: AxiosInstance;
  private accessToken?: string;
  private refreshToken?: string;

  constructor() {
    const app = loadAppConfig();
    this.config = app.bitrix;
    this.retry = {
      maxAttempts: app.sync.retryMaxAttempts,
      baseDelayMs: app.sync.retryBaseDelayMs,
    };
    const stored = this.readStoredToken();
    this.accessToken = stored.access_token || app.bitrix.oauthAccessToken;
    this.refreshToken = stored.refresh_token || app.bitrix.oauthRefreshToken;
    this.http = axios.create({ timeout: 20000 });
  }

  async addLead(fields: Record<string, unknown>): Promise<string> {
    const result = await this.call<number>('crm.lead.add', { fields });
    return String(result);
  }

  async updateLead(id: string, fields: Record<string, unknown>): Promise<boolean> {
    return this.call<boolean>('crm.lead.update', { id, fields });
  }

  async getLead(id: string): Promise<BitrixLead | undefined> {
    try {
      return await this.call<BitrixLead>('crm.lead.get', { id });
    } catch (error) {
      this.logger.warn(`Không lấy được lead ${id}: ${extractMessage(error)}`);
      return undefined;
    }
  }

  async findDuplicate(email?: string, phone?: string): Promise<BitrixLead | undefined> {
    if (email) {
      const byEmail = await this.listLeads({ EMAIL: email }, ['ID', 'TITLE', 'DATE_MODIFY', 'EMAIL', 'PHONE']);
      if (byEmail[0]) {
        return byEmail[0];
      }
    }
    if (phone) {
      const byPhone = await this.listLeads({ PHONE: phone }, ['ID', 'TITLE', 'DATE_MODIFY', 'EMAIL', 'PHONE']);
      if (byPhone[0]) {
        return byPhone[0];
      }
    }
    return undefined;
  }

  /**
   * Tìm trùng hàng loạt bằng Bitrix batch (crm.lead.list), tối đa 50 lệnh / request.
   */
  async findDuplicatesBatch(
    queries: Array<{ email?: string; phone?: string }>,
  ): Promise<Array<BitrixLead | undefined>> {
    const commands: BatchCommand[] = [];
    queries.forEach((query, index) => {
      if (query.email) {
        commands.push({
          key: `e${index}`,
          method: 'crm.lead.list',
          params: { filter: { EMAIL: query.email }, select: ['ID', 'TITLE', 'DATE_MODIFY', 'EMAIL', 'PHONE'] },
        });
      }
      if (query.phone) {
        commands.push({
          key: `p${index}`,
          method: 'crm.lead.list',
          params: { filter: { PHONE: query.phone }, select: ['ID', 'TITLE', 'DATE_MODIFY', 'EMAIL', 'PHONE'] },
        });
      }
    });

    const executed = await this.batchExecute(commands);
    return queries.map((query, index) => {
      const byEmail = firstLead(executed[`e${index}`]?.value);
      if (byEmail) {
        return byEmail;
      }
      return firstLead(executed[`p${index}`]?.value);
    });
  }

  async mutateLeadsBatch(ops: LeadMutation[]): Promise<LeadMutationResult[]> {
    if (!ops.length) {
      return [];
    }
    const commands: BatchCommand[] = ops.map((op, index) => ({
      key: `m${index}`,
      method: op.type === 'add' ? 'crm.lead.add' : 'crm.lead.update',
      params: op.type === 'add' ? { fields: op.fields } : { id: op.id, fields: op.fields },
    }));
    const executed = await this.batchExecute(commands);
    return ops.map((op, index) => {
      const item = executed[`m${index}`];
      if (!item?.ok) {
        return { ok: false, error: item?.error || 'Bitrix batch error' };
      }
      if (op.type === 'add') {
        return { ok: true, id: String(item.value) };
      }
      return { ok: true, id: op.id };
    });
  }

  async listLeads(
    filter: Record<string, unknown> = {},
    select: string[] = ['*', 'EMAIL', 'PHONE', 'UF_*'],
  ): Promise<BitrixLead[]> {
    const items: BitrixLead[] = [];
    let start = 0;
    for (;;) {
      const page = await this.callPage<BitrixLead[]>('crm.lead.list', {
        filter,
        select,
        start,
      });
      items.push(...(page.result ?? []));
      if (page.next === undefined) {
        break;
      }
      start = page.next;
    }
    return items;
  }

  async listModifiedSince(isoDate?: string): Promise<BitrixLead[]> {
    const filter: Record<string, unknown> = {};
    if (isoDate) {
      filter['>DATE_MODIFY'] = isoDate;
    }
    return this.listLeads(filter);
  }

  async batch(
    commands: Array<{ halt?: 0 | 1; method: string; params: Record<string, unknown> }>,
  ): Promise<unknown[]> {
    const mapped = commands.map((item, index) => ({
      key: `c${index}`,
      method: item.method,
      params: item.params,
    }));
    const executed = await this.batchExecute(mapped);
    return mapped.map((item) => executed[item.key]?.value);
  }

  async batchExecute(commands: BatchCommand[]): Promise<Record<string, BatchItemResult>> {
    const output: Record<string, BatchItemResult> = {};
    if (!commands.length) {
      return output;
    }
    const size = this.config.batchSize || 50;
    for (let i = 0; i < commands.length; i += size) {
      if (i > 0 && this.config.batchPauseMs > 0) {
        await sleep(this.config.batchPauseMs);
      }
      const slice = commands.slice(i, i + size);
      const cmd: Record<string, string> = {};
      slice.forEach((item) => {
        cmd[item.key] = `${item.method}?${toQuery(item.params)}`;
      });
      const raw = await this.call<Record<string, unknown>>('batch', { halt: 0, cmd });
      const success = (raw?.result as Record<string, unknown> | undefined) ?? {};
      const errors = (raw?.result_error as Record<string, unknown> | undefined) ?? {};
      for (const item of slice) {
        if (errors[item.key]) {
          output[item.key] = { ok: false, error: describeBitrixError(errors[item.key]) };
        } else {
          output[item.key] = { ok: true, value: success[item.key] };
        }
      }
    }
    return output;
  }

  async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const page = await this.callPage<T>(method, params);
    return page.result;
  }

  async refreshOAuthToken(): Promise<void> {
    if (!this.config.oauthClientId || !this.config.oauthClientSecret || !this.refreshToken) {
      throw new Error('Không thể refresh Bitrix OAuth: thiếu client id/secret hoặc refresh_token');
    }
    const response = await this.http.get<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>('https://oauth.bitrix.info/oauth/token/', {
      params: {
        grant_type: 'refresh_token',
        client_id: this.config.oauthClientId,
        client_secret: this.config.oauthClientSecret,
        refresh_token: this.refreshToken,
      },
    });
    this.accessToken = response.data.access_token;
    if (response.data.refresh_token) {
      this.refreshToken = response.data.refresh_token;
    }
    this.persistToken({
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      expires: Date.now() + (response.data.expires_in ?? 3600) * 1000,
    });
    this.logger.log('Đã refresh Bitrix OAuth access token');
  }

  private async callPage<T>(
    method: string,
    params: Record<string, unknown>,
    retriedAuth = false,
  ): Promise<{ result: T; next?: number }> {
    return withRetry(async () => {
      try {
        const url = await this.buildUrl(method);
        const response = await this.http.post<BitrixResponse<T>>(url, params);
        const body = response.data;
        if (body.error && isAuthError(body.error) && !retriedAuth && this.config.authMode === 'oauth2') {
          await this.refreshOAuthToken();
          return this.callPage<T>(method, params, true);
        }
        if (body.error) {
          const error = new Error(body.error_description || body.error);
          (error as { status?: number }).status = mapBitrixError(body.error);
          throw error;
        }
        return { result: body.result, next: body.next };
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 401 && !retriedAuth && this.config.authMode === 'oauth2') {
          await this.refreshOAuthToken();
          return this.callPage<T>(method, params, true);
        }
        throw error;
      }
    }, this.retry);
  }

  private async buildUrl(method: string): Promise<string> {
    if (this.config.authMode === 'oauth2') {
      const domain = this.config.oauthDomain;
      if (!domain) {
        throw new Error('Thiếu BITRIX_OAUTH_DOMAIN');
      }
      const token = this.accessToken;
      if (!token) {
        throw new Error('Thiếu Bitrix OAuth access token');
      }
      return `https://${domain}/rest/${method}.json?auth=${encodeURIComponent(token)}`;
    }

    const webhook = this.config.webhookUrl;
    if (!webhook) {
      throw new Error('Thiếu BITRIX_WEBHOOK_URL');
    }
    const base = webhook.endsWith('/') ? webhook : `${webhook}/`;
    return `${base}${method}.json`;
  }

  private readStoredToken(): StoredBitrixToken {
    const file = this.config.oauthTokenFile;
    if (!file || !existsSync(file)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as StoredBitrixToken;
    } catch {
      return {};
    }
  }

  private persistToken(token: StoredBitrixToken): void {
    const file = this.config.oauthTokenFile;
    if (!file) {
      return;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(token, null, 2), 'utf8');
  }
}

function firstLead(value: unknown): BitrixLead | undefined {
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
    return value[0] as BitrixLead;
  }
  return undefined;
}

function describeBitrixError(value: unknown): string {
  if (!value) {
    return 'Unknown Bitrix error';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    const record = value as { error_description?: string; error?: string };
    return record.error_description || record.error || JSON.stringify(value);
  }
  return String(value);
}

function isAuthError(code: string): boolean {
  return ['expired_token', 'invalid_token', 'ERROR_OAUTH'].includes(code);
}

function toQuery(params: Record<string, unknown>): string {
  const parts: string[] = [];
  const walk = (prefix: string, value: unknown) => {
    if (value === undefined || value === null) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(`${prefix}[${index}]`, item));
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
        walk(`${prefix}[${key}]`, nested);
      });
      return;
    }
    parts.push(`${prefix}=${encodeURIComponent(String(value))}`);
  };
  Object.entries(params).forEach(([key, value]) => walk(key, value));
  return parts.join('&');
}

function mapBitrixError(code: string): number {
  if (code === 'QUERY_LIMIT_EXCEEDED' || code === 'OVERLOAD_LIMIT') {
    return 429;
  }
  if (isAuthError(code)) {
    return 401;
  }
  return 400;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
