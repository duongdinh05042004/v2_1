# Deployment

## Biến môi trường bắt buộc (production)

- `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_FILE` (hoặc bộ OAuth)
- `BITRIX_WEBHOOK_URL` (hoặc bộ OAuth)
- `ADMIN_API_TOKEN` (bắt buộc khi expose internet)
- `SYNC_CRON`, `SYNC_DIRECTION`
- `MAPPING_FILE`

Không đưa secret vào image Docker. Dùng `env_file` + volume `credentials/`.

## Docker Compose

```bash
cp .env.example .env
# điền secret
mkdir -p credentials data logs
docker compose up --build -d
docker compose logs -f
```

Healthcheck: `GET /api/health`.

## Process manager (không Docker)

```bash
npm ci
npm run build
PORT=3000 NODE_ENV=production node dist/main
```

Hoặc systemd / PM2: `pm2 start dist/main --name sheets-bitrix-sync`.

Job one-shot (cron OS thay vì scheduler nội bộ):

```bash
node dist/cli.js sync
```

Khi dùng cron OS, đặt `SYNC_CRON` thành giá trị rất thưa hoặc tắt scheduler bằng cách không start HTTP app.

## Checklist trước go-live

1. Service account đã được share Editor trên Sheet.
2. Webhook Bitrix có quyền CRM.
3. `mapping.json` khớp header thật.
4. Chạy `npm run sync -- --dry-run` rồi đối chiếu log.
5. Chạy 3–5 hàng thật, xác nhận Lead ID ghi ngược.
6. Bật cron 15 phút sau khi dry-run ổn.
7. Backup Sheet trước lần sync lớn.
