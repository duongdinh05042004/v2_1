# HTTP API

Base URL mặc định: `http://localhost:3000`

Các route admin (trừ `/`, `/api/health`, `/auth/google*`) yêu cầu header `x-admin-token` hoặc `Authorization: Bearer <token>` nếu `ADMIN_API_TOKEN` được set.

## Health

```
GET /api/health
```

```json
{ "ok": true, "service": "sheets-bitrix24-sync", "direction": "one_way", "cron": "*/15 * * * *", "running": false }
```

## Trigger đồng bộ

```
POST /api/sync/trigger?direction=one_way&dryRun=false
```

`direction`: `one_way` | `two_way`  
`dryRun`: `true` | `false`

Response: `SyncRunResult` (runId, counters, records[]).

## Trạng thái

```
GET /api/sync/status
```

## Logs

```
GET /api/logs?limit=20
```

## Config / mapping

```
GET  /api/config
POST /api/mapping
```

Body `POST` là toàn bộ `mapping.json`.

## Google OAuth

```
GET /auth/google
GET /auth/google/callback?code=...
```

## Bitrix webhook

```
POST /api/webhooks/bitrix
Header: x-webhook-token: <ADMIN_API_TOKEN>
```

Payload Bitrix điển hình:

```json
{
  "event": "ONCRMLEADUPDATE",
  "data": { "FIELDS": { "ID": "123" } }
}
```

## CLI tương đương

```bash
npm run sync -- --direction one_way
npm run sync -- --dry-run
npx ts-node src/cli.ts status
```
