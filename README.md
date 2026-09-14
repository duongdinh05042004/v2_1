# Đồng bộ Google Sheets ↔ Bitrix24 CRM

Hệ thống tự động đọc danh sách lead từ Google Sheets, tạo/cập nhật lead trên Bitrix24, chống trùng theo Email/SĐT, ghi Lead ID ngược lại Sheet, chạy theo lịch hoặc trigger thủ công (CLI / HTTP / admin panel).

Hỗ trợ thêm (điểm cộng): đồng bộ hai chiều, webhook real-time từ Bitrix24, chuẩn hóa dữ liệu (email, SĐT VN, enum, số), và giao diện quản trị web.

## Kiến trúc nhanh

```
Google Sheets  --(API v4)-->  Sync Engine  --(REST/batch)-->  Bitrix24 CRM
       ^                         |  cron / CLI / HTTP
       |                         v
       +------ webhook Bitrix ---+------ Admin UI / Logs
```

Chi tiết thiết kế: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · API: [docs/API.md](docs/API.md) · Deploy: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · Test: [docs/TESTING.md](docs/TESTING.md)

## Yêu cầu

- Node.js 20+
- Tài khoản Google Cloud (Sheets API)
- Portal Bitrix24 (incoming webhook hoặc OAuth app)
- Docker (tuỳ chọn)

## 1. Cài đặt

```bash
git clone <repo>
cd sheets-bitrix24-sync
cp .env.example .env
npm install
```

## 2. Thiết lập Google API credentials

### Cách A — Service Account (khuyến nghị cho server)

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → tạo project.
2. Enable **Google Sheets API**.
3. IAM & Admin → Service Accounts → Create.
4. Tạo key JSON, lưu vào `credentials/service-account.json` (không commit).
5. Mở Google Sheet chứa leads → Share → thêm email service account (role **Editor**).
6. Copy Spreadsheet ID từ URL:
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`
7. Trong `.env`:

```env
GOOGLE_AUTH_MODE=service_account
GOOGLE_SERVICE_ACCOUNT_FILE=./credentials/service-account.json
GOOGLE_SHEET_ID=<SHEET_ID>
GOOGLE_WORKSHEET_NAME=Leads
```

### Cách B — OAuth 2.0 (user login)

1. Google Cloud → APIs & Services → Credentials → OAuth client (Web application).
2. Redirect URI: `http://localhost:3000/auth/google/callback`
3. `.env`:

```env
GOOGLE_AUTH_MODE=oauth2
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_OAUTH_TOKEN_FILE=./credentials/google-oauth-token.json
```

4. Chạy app, mở `http://localhost:3000/auth/google`, đăng nhập và chấp thuận. Token được lưu local.

## 3. Thiết lập Bitrix24 webhook

1. Bitrix24 → Developer resources → Other → **Inbound webhook**.
2. Quyền tối thiểu: `crm` (lead).
3. Copy URL dạng `https://<domain>.bitrix24.com/rest/1/<token>/`
4. `.env`:

```env
BITRIX_AUTH_MODE=webhook
BITRIX_WEBHOOK_URL=https://your-domain.bitrix24.com/rest/1/xxxxx/
```

OAuth 2.0: đặt `BITRIX_AUTH_MODE=oauth2` và điền `BITRIX_OAUTH_*`.

### Webhook outbound (real-time, tuỳ chọn)

Bitrix24 → Outbound webhook / automation rule:

- Event: `ONCRMLEADADD`, `ONCRMLEADUPDATE`
- URL: `https://<your-host>/api/webhooks/bitrix`
- Header: `x-webhook-token: <ADMIN_API_TOKEN>`

## 4. Chuẩn bị Google Sheet

Cột nghiệp vụ (có thể đổi tên nếu sửa `config/mapping.json`):

| Cột | Bitrix field |
| --- | --- |
| Tên khách hàng | TITLE |
| Email | EMAIL |
| Số điện thoại | PHONE |
| Công ty | COMPANY_TITLE |
| Nguồn lead (UTM Source) | UTM_SOURCE + SOURCE_ID |
| Ngân sách dự kiến | OPPORTUNITY |
| Trạng thái | STATUS_ID |
| Người phụ trách | ASSIGNED_BY_ID |
| Ghi chú | COMMENTS |
| Ngành nghề | UF_CRM_INDUSTRY (custom) |

File mẫu: [samples/leads-template.csv](samples/leads-template.csv) — File → Import vào Sheet.

Lần chạy đầu, hệ thống **tự thêm** các cột hệ thống nếu chưa có, rồi **ẩn** `Lead ID Bitrix24` và `Sync Hash` trên Sheet:

- `Lead ID Bitrix24`
- `Trạng thái đồng bộ` (`Chờ xử lý` / `Đã đồng bộ` / `Lỗi` / `Bỏ qua`)
- `Thời gian đồng bộ cuối`
- `Thông báo lỗi`
- `Sync Hash`

Có thể ẩn 2 cột `Lead ID Bitrix24` và `Sync Hash` trên Sheet; ứng dụng vẫn đọc/ghi được.

## 5. Cấu hình mapping

File `config/mapping.json`:

- `columns`: ánh xạ cột Sheet → field Bitrix (`string`, `email`, `phone`, `number`, `date`, `enum`)
- `customFields`: field `UF_CRM_*`
- `enumMap`: map giá trị tiếng Việt → ID Bitrix
- `dedupeFields`: `email` / `phone`
- `twoWayFields`: field kéo ngược từ Bitrix
- `conflictStrategy`: `last_write_wins` | `sheet_wins` | `bitrix_wins`

Có thể sửa mapping trên admin UI (`POST /api/mapping`) mà không cần redeploy.

## 6. Chạy ứng dụng

```bash
# API + admin + cron
npm run start:dev

# Production
npm run build
npm run start:prod

# Đồng bộ thủ công (CLI)
npm run sync
npm run sync -- --direction two_way
npm run sync -- --dry-run

# HTTP
curl -X POST http://localhost:3000/api/sync/trigger \
  -H "x-admin-token: change-me-in-production"
```

Admin panel: [http://localhost:3000](http://localhost:3000)

Lịch mặc định: mỗi 15 phút (`SYNC_CRON=*/15 * * * *`). Đổi trong `.env`:

| Cron | Ý nghĩa |
| --- | --- |
| `*/15 * * * *` | mỗi 15 phút |
| `0 * * * *` | mỗi giờ |
| `0 8 * * *` | 08:00 hàng ngày |

## 7. Docker

```bash
docker compose up --build -d
```

Mount `credentials/`, `config/`, `data/`, `logs/` — secrets không nằm trong image.

## 8. Monitor và maintain

- Admin UI: bảng log (created / updated / skipped / errors / pulled)
- File log: `logs/sync-YYYY-MM-DD.jsonl`
- Health: `GET /api/health`
- Cột Sheet `Thông báo lỗi` + `Trạng thái đồng bộ=Lỗi` để admin sửa tay rồi chạy lại
- Hash không đổi → hàng được **bỏ qua** (idempotent, chạy lại job không tạo lead trùng)

## 9. Troubleshoot

| Hiện tượng | Cách xử lý |
| --- | --- |
| `Không tìm thấy service account` | Kiểm tra path `GOOGLE_SERVICE_ACCOUNT_FILE` |
| Google `403 The caller does not have permission` | Share Sheet cho email service account, quyền Editor |
| `Thiếu BITRIX_WEBHOOK_URL` | Điền inbound webhook, có dấu `/` cuối |
| `QUERY_LIMIT_EXCEEDED` | Hệ thống tự retry + backoff. Giảm tần suất cron hoặc `BITRIX_BATCH_SIZE` |
| Email không hợp lệ | Sửa ô Email; validation chặn trước khi gọi API |
| Tạo lead trùng | Kiểm tra email/SĐT đã chuẩn hóa; xem log "Phát hiện trùng" |
| OAuth Google hết hạn | Xoá token, mở lại `/auth/google` |
| Job "đang chạy" | Đợi job hiện tại xong; không trigger song song |
| Custom field không lên Bitrix | Tạo field `UF_CRM_*` trên portal rồi khai báo trong `customFields` |

## 10. Bảo mật

- Không commit `.env`, `credentials/*.json`, token OAuth
- Đặt `ADMIN_API_TOKEN` trên môi trường public
- Webhook Bitrix nên đi kèm token header
- Helmet được bật trên HTTP server

## 11. Tests

```bash
npm test
npm run test:cov
```

Ngưỡng coverage: **70%** (statements/lines/functions). Kịch bản TC1–TC4 và perf 120 records nằm trong `test/`.

## Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run start:dev` | Dev server + watch + cron |
| `npm run sync` | CLI đồng bộ 1 lần |
| `npm test` | Unit tests |
| `npm run test:cov` | Coverage |
| `docker compose up` | Deploy container |
