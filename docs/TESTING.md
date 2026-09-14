# Kịch bản kiểm thử

Chạy: `npm test` · Coverage: `npm run test:cov`

## Test cases cơ bản (đã tự động hoá trong `test/sync.service.spec.ts`)

### TC1 — Tạo lead mới

- **Given:** Hàng mới, đủ Tên + Email, chưa có Lead ID.
- **When:** `SyncService.run('one_way')`.
- **Then:** Gọi `crm.lead.add`; Sheet nhận Lead ID; status `Đã đồng bộ`.

### TC2 — Cập nhật lead

- **Given:** Hàng đã có Lead ID, sync hash khác payload hiện tại.
- **When:** Chạy sync.
- **Then:** `crm.lead.update(id)`; thời gian sync được ghi.

### TC3 — Trùng lặp

- **Given:** Không có Lead ID nhưng email đã tồn tại trên Bitrix.
- **When:** `findDuplicate` trả về lead sẵn có.
- **Then:** Update lead đó, **không** gọi add.

### TC4 — Error handling

- **Given:** Hàng 1 ném lỗi API, hàng 2 hợp lệ.
- **When:** Chạy sync.
- **Then:** Hàng 1 `action=error` + message; hàng 2 vẫn được tạo; job không abort.

## Performance

`test/performance.sync.spec.ts`: 120 records (có hàng lỗi xen kẽ). Kỳ vọng:

- Tổng created + updated + errors = 120
- Thời gian < 5s với mock I/O
- Không timeout, không dừng giữa chừng

Trên môi trường thật (100+ hàng live): dùng `SYNC_DRY_RUN=false`, cron 15 phút, Bitrix batch ≤ 50, retry khi 429.

## Mapping / chất lượng dữ liệu

- Email lowercase, SĐT `090…` → `+8490…`
- Enum `Mới` → `NEW`
- Custom field `UF_CRM_*`
- Validation chặn hàng thiếu TITLE/email

## Conflict (two-way)

- Chỉ Sheet đổi → sheet
- Chỉ Bitrix đổi → bitrix
- Cả hai: `last_write_wins` theo timestamp hoặc `sheet_wins` / `bitrix_wins`
