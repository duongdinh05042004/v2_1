const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const { writeFileSync } = require('fs');
const { join } = require('path');

const h = (text, level = HeadingLevel.HEADING_1) =>
  new Paragraph({
    heading: level,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true })],
  });

const p = (text) =>
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
  });

const say = (text) =>
  new Paragraph({
    spacing: { after: 100, before: 80 },
    shading: { type: 'clear', fill: 'FFF3CD' },
    children: [
      new TextRun({ text: 'ĐỌC: ', bold: true, size: 22, font: 'Calibri', color: '7C4A00' }),
      new TextRun({ text, size: 22, font: 'Calibri' }),
    ],
  });

const open = (text) =>
  new Paragraph({
    spacing: { after: 80 },
    shading: { type: 'clear', fill: 'D6EAF8' },
    children: [
      new TextRun({ text: 'MỞ CODE: ', bold: true, size: 22, font: 'Calibri', color: '1A5276' }),
      new TextRun({ text, size: 22, font: 'Calibri' }),
    ],
  });

const doAct = (text) =>
  new Paragraph({
    spacing: { after: 70 },
    children: [
      new TextRun({ text: 'LÀM: ', bold: true, size: 22, font: 'Calibri', color: '0B4F8A' }),
      new TextRun({ text, size: 22, font: 'Calibri', italics: true }),
    ],
  });

const note = (text) =>
  new Paragraph({
    spacing: { after: 70 },
    children: [
      new TextRun({ text: 'LƯU Ý: ', bold: true, size: 20, font: 'Calibri', color: '666666' }),
      new TextRun({ text, size: 20, font: 'Calibri', italics: true, color: '666666' }),
    ],
  });

const doc = new Document({
  sections: [
    {
      properties: { page: { margin: { top: 640, bottom: 640, left: 800, right: 800 } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: 'KỊCH BẢN ĐỌC VIDEO DEMO', bold: true, size: 36, font: 'Calibri' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: 'Chi tiết: mở file nào — nhảy dòng nào — đọc câu nào  |  Dưới 5 phút',
              size: 22,
              font: 'Calibri',
            }),
          ],
        }),

        p('In file này hoặc để nửa màn hình phải. Nửa trái: Chrome + Cursor. Dòng vàng ĐỌC thì đọc nguyên văn. Dòng xanh MỞ CODE thì làm đúng phím. Dòng LÀM không đọc.'),
        p('Trong Cursor: Ctrl+P rồi gõ đúng tên file. Ctrl+G rồi gõ số dòng. Kéo chọn đúng khoảng dòng cho to. Zoom editor 16–18px. Không mở .env, credentials, token.'),

        h('Chuẩn bị (không quay)'),
        doAct('Chạy npm run start:dev. Mở Chrome http://localhost:3000 (zoom 125%).'),
        doAct('Mở Cursor workspace d:\\v2_1. Thu Explorer bên trái để thấy thư mục src.'),
        doAct('Ghim sẵn (chuột phải tab → Pin) các file: src/sync/sync.service.ts, src/bitrix24/bitrix24.service.ts, src/sync/mapping.service.ts, config/mapping.json.'),
        doAct('Windows + G bật quay. Micro rõ. Ẩn Discord/Zalo.'),

        h('PHẦN 1 — Intro trên web  (0:00 – 0:25)'),
        doAct('Toàn màn hình Chrome, trang admin. Không click.'),
        say('Xin chào. Em demo hệ thống tích hợp Google Sheets với Bitrix24 CRM để đồng bộ lead tự động.'),
        say('Lead đang nằm trên Google Sheets từ form, sự kiện, đối tác. CRM chính là Bitrix24. Trước đây phải nhập tay, dễ sai. Hệ thống đọc Sheet, map cột, tạo hoặc cập nhật lead, chống trùng email hoặc số điện thoại, ghi Lead ID ngược lại Sheet, và có log.'),

        h('PHẦN 2 — Cách dùng admin  (0:25 – 0:55)'),
        doAct('Di chuột từ trên xuống từng khối.'),
        say('Đây là trang quản trị đúng bốn việc đề yêu cầu.'),
        doAct('Chỉ Trạng thái đồng bộ.'),
        say('Xem hệ thống sẵn sàng hay đang chạy, lần sync cuối, số tạo, cập nhật, bỏ qua, lỗi.'),
        doAct('Chỉ nút Chạy đồng bộ ngay.'),
        say('Admin bấm để chạy ngay. Ngoài ra còn lịch cron và lệnh CLI.'),
        doAct('Cuộn tới Cấu hình mapping.'),
        say('Trái là cột Google Sheet, phải là field Bitrix24. Bấm Lưu sẽ ghi file mapping.json, không phải sửa code.'),
        doAct('Cuộn tới Nhật ký.'),
        say('Mỗi lần chạy có số tạo, cập nhật, bỏ qua, lỗi và nguyên nhân.'),

        h('PHẦN 3 — Kiến trúc trong Explorer  (0:55 – 1:15)'),
        doAct('Alt+Tab sang Cursor. Click thư mục src trên Explorer, bung các folder, không mở hết file.'),
        open('Không cần Ctrl+P. Chỉ nhìn Explorer: src/google, src/bitrix24, src/sync, src/admin, src/webhook, src/core.'),
        say('Code tách theo trách nhiệm. Thư mục google gọi Sheets API. Thư mục bitrix24 gọi REST CRM. Thư mục sync là nghiệp vụ tạo, cập nhật, chống trùng. Admin là giao diện. Webhook nhận sự kiện realtime. Core là hash, chuẩn hóa, retry.'),
        note('Mất khoảng 15 giây. Đừng scroll lung tung.'),

        h('PHẦN 4 — Mapping  (1:15 – 1:40)'),
        open('Ctrl+P → gõ mapping.json → Enter. File nằm ở config/mapping.json.'),
        doAct('Ctrl+G → 16 → Enter. Kéo bôi dòng 16 đến 31: Tên khách hàng → TITLE, Email → EMAIL.'),
        say('Đây là mapping.json. Mỗi dòng nối một cột Sheet với một field Bitrix. Ví dụ Tên khách hàng vào TITLE, Email vào EMAIL. Có thể thêm custom field dạng UF_CRM.'),
        doAct('Ctrl+G → 70. Chỉ dòng Trạng thái, enumMap mới thành NEW nếu kịp.'),
        say('Trạng thái tiếng Việt được map sang STATUS_ID của Bitrix, ví dụ Mới thành NEW.'),
        open('Ctrl+P → mapping.service.ts → Enter. Ctrl+G → 59.'),
        doAct('Bôi dòng 59 đến 101, hàm normalizeRow.'),
        say('Hàm normalizeRow đọc từng cột theo mapping, chuẩn hóa giá trị, rồi tính sync hash. Có Lead ID cũ thì lần sau biết đây là cập nhật, không phải tạo mới.'),

        h('PHẦN 5 — Tạo / cập nhật / bỏ qua  (1:40 – 2:20)'),
        open('Ctrl+P → sync.service.ts → Enter. File src/sync/sync.service.ts.'),
        doAct('Ctrl+G → 44. Bôi dòng 44 đến 73, hàm run.'),
        say('Đây là cửa vào mỗi lần đồng bộ. Hàm run đẩy Sheet sang Bitrix. Nếu bật two way thì kéo ngược từ Bitrix về Sheet.'),
        doAct('Ctrl+G → 109. Bôi dòng 109 đến 158.'),
        say('Từng hàng được validate. Sai thì ghi Lỗi rồi bỏ qua hàng đó, không dừng cả job. Hàng hợp lệ được chuẩn hóa. Nếu đã có Lead ID và hash không đổi thì skipped, không gọi API. Đó là idempotent.'),
        doAct('Alt+Tab Chrome. Bấm Chạy đồng bộ ngay. Đợi chữ Xong.'),
        say('Em vừa bấm chạy thủ công. Đây là TC1: hàng mới được tạo, đếm ở cột Tạo trên nhật ký. Lead ID sẽ được ghi lại cho lần sau.'),

        h('PHẦN 6 — Chống trùng + batch  (2:20 – 3:00)'),
        doAct('Alt+Tab Cursor. Vẫn sync.service.ts.'),
        open('Ctrl+G → 219. Bôi dòng 219 đến 243, trong hàm upsertLeads.'),
        say('Với hàng chưa có Lead ID, hệ thống tìm trùng trước. Đã có ID trên Bitrix thì mutation là update. Chưa có mới add. Đó là TC3 chống trùng.'),
        open('Ctrl+P → bitrix24.service.ts → Enter. Ctrl+G → 87.'),
        doAct('Bôi dòng 87 đến 100, hàm findDuplicate.'),
        say('Tìm trùng bằng crm.lead.list theo EMAIL, không thấy thì theo PHONE. Có kết quả thì trả lead cũ, không tạo mới.'),
        doAct('Ctrl+G → 106. Chỉ comment và chữ findDuplicatesBatch, batch 50.'),
        say('Khi nhiều hàng, các lệnh list và add update được gom batch, tối đa năm mươi lệnh một request, để khỏi vượt rate limit Bitrix.'),

        h('PHẦN 7 — Hash, retry, lỗi  (3:00 – 3:40)'),
        open('Ctrl+P → hash.util.ts → Enter. File src/core/hash.util.ts. Ctrl+G → 7.'),
        doAct('Bôi dòng 7 đến 9 và 12 đến 25.'),
        say('computeSyncHash dùng SHA-256. Cùng dữ liệu thì cùng hash dù thứ tự field khác. Chạy lại job không đổi thì skipped. Đó là data integrity.'),
        open('Ctrl+P → retry.util.ts → Enter. Ctrl+G → 10.'),
        doAct('Bôi dòng 10 đến 27 rồi 29 đến 44.'),
        say('withRetry bắt lỗi 429, 500, timeout, rate limit. Mỗi lần chờ backoff rồi thử lại. Hết lần mới báo lỗi. Một hàng lỗi không chặn hàng khác — đúng TC4.'),
        doAct('Alt+Tab Chrome, chỉ cột Lỗi và Nguyên nhân lỗi.'),
        say('Trên giao diện, lỗi hiện nguyên nhân để admin sửa hàng rồi chạy lại.'),

        h('PHẦN 8 — Nút web, lịch, CLI, webhook  (3:40 – 4:20)'),
        open('Ctrl+P → admin.controller.ts → Enter. File src/admin/admin.controller.ts. Ctrl+G → 73.'),
        doAct('Bôi dòng 73 đến 95: trigger, status, logs.'),
        say('Nút Chạy đồng bộ gọi POST api/sync/trigger. Trạng thái lấy GET api/sync/status. Nhật ký lấy GET api/logs. Mapping lưu bằng POST api/mapping.'),
        open('Ctrl+P → sync.scheduler.ts → Enter. Ctrl+G → 13.'),
        doAct('Bôi dòng 13 đến 27: CronJob từ SYNC_CRON.'),
        say('Lịch mặc định mỗi mười lăm phút. Tới giờ gọi cùng hàm run, không viết hai luồng khác nhau.'),
        open('Ctrl+P → cli.ts → Enter. Ctrl+G → 15.'),
        doAct('Bôi dòng 15 đến 27: lệnh sync.'),
        say('Trên server có thể chạy npm run sync, không cần mở web.'),
        open('Ctrl+P → webhook.controller.ts → Enter. Ctrl+G → 8.'),
        doAct('Bôi dòng 8 đến 36.'),
        say('Điểm cộng realtime: Bitrix gửi ONCRMLEADUPDATE vào POST api/webhooks/bitrix, hàm applyBitrixLead cập nhật đúng hàng Sheet, không chờ cron. Two way nằm trong sync.service, kéo lead DATE_MODIFY.'),

        h('PHẦN 9 — Chuẩn hóa + test  (4:20 – 4:40)'),
        open('Ctrl+P → normalize.util.ts → Enter. Ctrl+G → 5.'),
        doAct('Bôi dòng 5 đến 13 normalizeEmail, rồi Ctrl+G → 20, bôi 20 đến 47 normalizePhone.'),
        say('Email được trim và lowercase. Số Việt Nam 090 thành cộng 84. Đảm bảo so trùng chính xác.'),
        open('Ctrl+P → sync.service.spec.ts → Enter. File test/sync.service.spec.ts. Ctrl+G → 109.'),
        doAct('Bôi tên 4 test: dòng 109 TC1, 132 TC2, 167 TC3, 191 TC4. Không cần chạy test trong video.'),
        say('Bốn test case đề bài đã viết trong file này và đã pass: tạo mới, cập nhật, chống trùng, lỗi một hàng không chặn hàng khác.'),

        h('PHẦN 10 — Kết  (4:40 – 4:55)'),
        doAct('Alt+Tab về Chrome, để trang admin. Dừng 2 giây.'),
        say('Tóm lại: mapping linh hoạt, tạo cập nhật đúng, chống trùng email số điện thoại, hash idempotent, retry khi API lỗi, admin đủ bốn chức năng, có lịch, CLI và webhook. Source code trên Git. Em xin hết demo. Cảm ơn thầy cô.'),
        doAct('Dừng quay. Xem lại dưới 5 phút, tiếng rõ, không lộ secret.'),

        h('Bảng phím tắt nhớ'),
        p('Ctrl+P  mở file theo tên'),
        p('Ctrl+G  nhảy tới số dòng'),
        p('Alt+Tab  đổi Chrome ↔ Cursor'),
        p('Ctrl+L  (trong Cursor) chọn cả dòng đang đứng'),

        h('Thứ tự file (nếu rối thì làm đúng list này)'),
        p('1. Chrome localhost:3000'),
        p('2. Explorer src (không mở file)'),
        p('3. config/mapping.json dòng 16–31'),
        p('4. src/sync/mapping.service.ts dòng 59–101'),
        p('5. src/sync/sync.service.ts dòng 44–73 rồi 109–158 rồi 219–243'),
        p('6. Chrome — bấm Chạy đồng bộ ngay'),
        p('7. src/bitrix24/bitrix24.service.ts dòng 87–100 và 106'),
        p('8. src/core/hash.util.ts dòng 7–9'),
        p('9. src/core/retry.util.ts dòng 10–44'),
        p('10. src/admin/admin.controller.ts dòng 73–95'),
        p('11. src/sync/sync.scheduler.ts dòng 13–27'),
        p('12. src/cli.ts dòng 15–27'),
        p('13. src/webhook/webhook.controller.ts dòng 8–36'),
        p('14. src/core/normalize.util.ts dòng 5–47'),
        p('15. test/sync.service.spec.ts dòng 109, 132, 167, 191'),
        p('16. Chrome — câu kết'),

        h('Nếu hết giờ'),
        p('Bỏ file cli.ts, webhook, normalize. Từ retry nhảy thẳng test TC1–TC4 rồi kết. Vẫn đủ chức năng chính.'),
        p('Nếu Ctrl+G lệch dòng vì code mới sửa: tìm tên hàm (run, upsertLeads, findDuplicate, normalizeRow, withRetry, handleBitrix) bằng Ctrl+F.'),
      ],
    },
  ],
});

const out = join(__dirname, '..', 'Kich-ban-doc-Video-Demo.docx');
Packer.toBuffer(doc).then((buf) => {
  writeFileSync(out, buf);
  process.stdout.write(out);
});
