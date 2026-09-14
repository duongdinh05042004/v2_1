# System Design

## Mục tiêu

Tách rõ 4 lớp: cấu hình/mapping, tích hợp API, nghiệp vụ đồng bộ, và giao diện kích hoạt (HTTP/CLI/cron). Mỗi lần chạy là một job idempotent: Lead ID + sync hash quyết định create / update / skip.

## Sơ đồ luồng một chiều (MVP)

```
┌─────────────┐  values.get   ┌──────────────┐  crm.lead.list/add/update  ┌──────────┐
│ Google Sheet│ ─────────────►│ SyncService  │ ──────────────────────────►│ Bitrix24 │
│  (Leads)    │◄──────────────│              │                            │   CRM    │
└─────────────┘  batchUpdate  └──────┬───────┘                            └──────────┘
                                     │ persist jsonl
                                     ▼
                               logs/sync-*.jsonl
```

1. Đọc toàn bộ worksheet, detect header.
2. Bảo đảm cột hệ thống tồn tại.
3. Với mỗi hàng:
   - Validation + normalize (email, E.164, enum, number).
   - Tính SHA-256 của payload đã map.
   - Hash không đổi + đã có Lead ID → skip.
   - Có Lead ID → `crm.lead.update`.
   - Chưa có ID → `crm.lead.list` theo EMAIL/PHONE; trùng thì update, không thì `crm.lead.add`.
4. Ghi ngược Lead ID, trạng thái, thời gian, hash, lỗi bằng `spreadsheets.values.batchUpdate`.
5. Ghi log tổng (created/updated/skipped/errors).

## Đồng bộ hai chiều

- Kéo lead có `DATE_MODIFY` > `lastBitrixModifyAt` (lưu ở `data/sync-state.json`).
- Khớp hàng bằng `Lead ID Bitrix24`.
- Conflict:
  - `last_write_wins`: so timestamp Sheet vs Bitrix.
  - `sheet_wins` / `bitrix_wins`: ưu tiên cố định.
- Chỉ ghi các field trong `twoWayFields`.

## Real-time

`POST /api/webhooks/bitrix` nhận `ONCRMLEADADD|UPDATE` → `crm.lead.get` → patch đúng hàng Sheet.

## Thành phần

| Module | Trách nhiệm |
| --- | --- |
| `core/` | Config, hash, normalize, retry/backoff, A1 columns |
| `google/` | Service Account + OAuth, Sheets read/batch write |
| `bitrix24/` | Webhook/OAuth REST, list/add/update/batch |
| `sync/` | Mapping, validation, conflict, job, cron, logger |
| `admin/` | UI + HTTP trigger + health |
| `webhook/` | Inbound Bitrix events |
| `cli.ts` | `sync` / `status` không cần HTTP server |

## Idempotency & toàn vẹn

- Khoá `running` tránh 2 job song song.
- Sync hash ổn định theo key (không phụ thuộc thứ tự field).
- Dedup trước `crm.lead.add`.
- Dry-run không ghi Bitrix/Sheet.

## Rate limit

- `withRetry`: exponential backoff + jitter, mặc định 4 lần.
- Retry khi 429/5xx/timeout/`QUERY_LIMIT_EXCEEDED`.
- Bitrix `batch` tối đa 50 lệnh: dedup (`crm.lead.list`) và create/update đi qua `findDuplicatesBatch` / `mutateLeadsBatch`, nghỉ `BITRIX_BATCH_PAUSE_MS` giữa các chunk.
- OAuth Bitrix: tự `refresh_token` khi `expired_token` / HTTP 401, ghi lại `BITRIX_OAUTH_TOKEN_FILE`.
- Two-way / webhook: nếu lead chưa có trên Sheet thì **append hàng mới** (không chỉ update hàng sẵn có).
- Cột Lead ID + Sync Hash được ẩn bằng Sheets `updateDimensionProperties`.
- Google `batchUpdate` chia chunk 100 range.
- Lỗi 1 hàng không abort cả job.

## Mở rộng

- Thêm CRM khác: implement interface giống `Bitrix24Service`.
- Thêm entity Contact/Deal: tái sử dụng mapping + hash.
- Queue (Bull/Redis) nếu dataset hàng nghìn dòng.
