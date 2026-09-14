export type SyncDirection = 'one_way' | 'two_way';
export type AuthModeGoogle = 'service_account' | 'oauth2';
export type AuthModeBitrix = 'webhook' | 'oauth2';
export type ConflictStrategy = 'last_write_wins' | 'sheet_wins' | 'bitrix_wins';
export type FieldType = 'string' | 'email' | 'phone' | 'number' | 'date' | 'enum';
export type SyncStatus = 'Chờ xử lý' | 'Đã đồng bộ' | 'Lỗi' | 'Bỏ qua';
export type RecordAction = 'created' | 'updated' | 'skipped' | 'error' | 'pulled';

export interface FieldMapping {
  sheet: string;
  bitrix: string;
  type: FieldType;
  required?: boolean;
  trim?: boolean;
  multivalue?: boolean;
  enumMap?: Record<string, string>;
  alsoWrite?: string;
}

export interface MappingConfig {
  version: number;
  dedupeFields: Array<'email' | 'phone'>;
  conflictStrategy?: ConflictStrategy;
  systemColumns: {
    leadId: string;
    syncStatus: string;
    lastSyncAt: string;
    errorMessage: string;
    syncHash: string;
    sheetUpdatedAt?: string;
  };
  columns: FieldMapping[];
  customFields?: FieldMapping[];
  twoWayFields?: string[];
}

export interface SheetRow {
  rowIndex: number;
  values: Record<string, string>;
}

export interface NormalizedLead {
  rowIndex: number;
  title: string;
  fields: Record<string, unknown>;
  email?: string;
  phone?: string;
  hash: string;
  existingLeadId?: string;
  previousHash?: string;
  sheetUpdatedAt?: string;
}

export interface SyncCounters {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  pulled: number;
}

export interface RecordLog {
  rowIndex: number;
  action: RecordAction;
  leadId?: string;
  message: string;
  error?: string;
}

export interface SyncRunResult {
  runId: string;
  startedAt: string;
  finishedAt: string;
  direction: SyncDirection;
  dryRun: boolean;
  counters: SyncCounters;
  records: RecordLog[];
}

export interface SyncState {
  lastOneWayAt?: string;
  lastTwoWayAt?: string;
  lastBitrixModifyAt?: string;
}

export interface BitrixLead {
  ID: string;
  TITLE?: string;
  NAME?: string;
  COMPANY_TITLE?: string;
  STATUS_ID?: string;
  SOURCE_ID?: string;
  OPPORTUNITY?: string;
  ASSIGNED_BY_ID?: string;
  COMMENTS?: string;
  UTM_SOURCE?: string;
  DATE_MODIFY?: string;
  DATE_CREATE?: string;
  EMAIL?: Array<{ VALUE: string; VALUE_TYPE?: string }>;
  PHONE?: Array<{ VALUE: string; VALUE_TYPE?: string }>;
  [key: string]: unknown;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  adminApiToken?: string;
  mappingFile: string;
  syncStateFile: string;
  logDir: string;
  google: {
    authMode: AuthModeGoogle;
    serviceAccountFile?: string;
    oauthClientId?: string;
    oauthClientSecret?: string;
    oauthRedirectUri?: string;
    oauthTokenFile?: string;
    sheetId: string;
    worksheetName: string;
  };
  bitrix: {
    authMode: AuthModeBitrix;
    webhookUrl?: string;
    oauthClientId?: string;
    oauthClientSecret?: string;
    oauthDomain?: string;
    oauthAccessToken?: string;
    oauthRefreshToken?: string;
    oauthTokenFile?: string;
    batchSize: number;
    batchPauseMs: number;
  };
  sync: {
    direction: SyncDirection;
    cron: string;
    conflictStrategy: ConflictStrategy;
    dryRun: boolean;
    retryMaxAttempts: number;
    retryBaseDelayMs: number;
  };
}
