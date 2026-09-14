const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const { writeFileSync } = require('fs');
const { join } = require('path');

const heading = (text, level = HeadingLevel.HEADING_1) =>
  new Paragraph({ heading: level, spacing: { before: 280, after: 140 }, children: [new TextRun({ text, bold: true })] });

const p = (text) =>
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
  });

const bullet = (text) =>
  new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
  });

const numbered = (text, ref = 'steps') =>
  new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
  });

const boldLine = (label, text) =>
  new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: label, bold: true, size: 22, font: 'Calibri' }),
      new TextRun({ text, size: 22, font: 'Calibri' }),
    ],
  });

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [
          {
            level: 0,
            format: 'bullet',
            text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 220 } } },
          },
        ],
      },
      {
        reference: 'steps',
        levels: [
          {
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 220 } } },
          },
        ],
      },
      {
        reference: 'script',
        levels: [
          {
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 220 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 864, right: 864 } },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: 'HƯỚNG DẪN NỘP BÀI',
              bold: true,
              size: 36,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: 'Tích hợp Google Sheets với Bitrix24',
              italics: true,
              size: 26,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 320 },
          children: [
            new TextRun({
              text: 'Submission: Git repository + Demo video (dưới 5 phút)',
              size: 22,
              font: 'Calibri',
              color: '333333',
            }),
          ],
        }),

        heading('1. Yêu cầu nộp bài'),
        p('Theo đề, bài nộp gồm hai phần bắt buộc:'),
        bullet('Source code trên Git repository (GitHub hoặc GitLab).'),
        bullet('Video demo ngắn dưới 5 phút, trình bày các tính năng chính và cách sử dụng hệ thống.'),
        p('Hai phần này bổ sung cho nhau: Git để chấm code, kiến trúc, test; video để giám khảo thấy hệ thống chạy và cách dùng mà không cần tự setup lâu.'),

        heading('2. Nộp source code qua GitHub / GitLab'),
        heading('2.1. Việc cần làm trước khi đẩy lên Git', HeadingLevel.HEADING_2),
        numbered('Kiểm tra không có secret: không commit file .env, credentials/service-account.json, token OAuth, webhook thật.'),
        numbered('Trong repo phải có: .env.example, config/mapping.json, samples/leads-template.csv, Dockerfile, docker-compose.yml, README.md, thư mục src/ và test/.'),
        numbered('Chạy npm test để chắc test vẫn pass.'),
        numbered('File .gitignore đã loại node_modules/, dist/, .env, credentials/*.json, data/, logs/.'),

        heading('2.2. Đưa code lên GitHub (gợi ý)', HeadingLevel.HEADING_2),
        numbered('Tạo repository mới trên GitHub (nên để Private nếu đề không bắt buộc public).'),
        numbered('Trong thư mục dự án, chạy: git init'),
        numbered('git add .'),
        numbered('git commit -m "Submit: Google Sheets - Bitrix24 lead sync"'),
        numbered('git branch -M main'),
        numbered('git remote add origin https://github.com/<ten-van>/<ten-repo>.git'),
        numbered('git push -u origin main'),
        p('GitLab tương tự: tạo project mới, thêm remote, rồi git push. Nộp link HTTPS của repository (và quyền truy cập cho giám khảo nếu repo private).'),

        heading('2.3. Nội dung README khi giám khảo mở repo', HeadingLevel.HEADING_2),
        bullet('Cách cài: npm install, copy .env.example thành .env.'),
        bullet('Cách chạy: npm run start:dev, mở http://localhost:3000.'),
        bullet('Cách test: npm test / npm run test:cov.'),
        bullet('Cách setup Google Service Account và Bitrix webhook (đã có trong README).'),
        bullet('Link video demo (dán vào README hoặc nộp kèm form).'),

        heading('3. Video demo dưới 5 phút'),
        heading('3.1. Mục tiêu video', HeadingLevel.HEADING_2),
        p('Trong tối đa 4 phút 50 giây, người xem hiểu được: hệ thống giải quyết gì, chạy ra sao, các tính năng cốt lõi hoạt động thế nào, và cách sử dụng admin panel. Không cần đọc hết code.'),

        heading('3.2. Kịch bản quay (khoảng 4 phút 30 giây)', HeadingLevel.HEADING_2),
        boldLine('0:00 – 0:25 — Giới thiệu. ', 'Nêu tên đề: đồng bộ lead Google Sheets → Bitrix24. Nói rõ vấn đề (nhập tay, sai sót) và giải pháp (tự động, chống trùng, log, lịch).'),
        boldLine('0:25 – 0:50 — Kiến trúc rất ngắn. ', 'Mở sơ đồ hoặc nói 4 khối: Google Sheets API, Sync Engine, Bitrix24 REST, Admin. Nhắc mapping.json và biến môi trường, không hiện secret trên màn hình.'),
        boldLine('0:50 – 1:30 — Cách sử dụng. ', 'Mở http://localhost:3000. Chỉ 4 phần đúng đề: trạng thái đồng bộ, nút chạy thủ công, cấu hình mapping, nhật ký. Lưu 1 dòng mapping để thấy ghi mapping.json.'),
        boldLine('1:30 – 2:20 — TC1 Tạo lead mới. ', 'Thêm 1 hàng trên Google Sheet (hoặc file mẫu nếu demo local). Bấm Chạy đồng bộ ngay. Chỉ log: tạo = 1, Lead ID được ghi, trạng thái Đã đồng bộ.'),
        boldLine('2:20 – 2:55 — TC2 Cập nhật. ', 'Sửa tên/số trên hàng đã có Lead ID. Chạy lại. Log: cập nhật = 1, không tạo bản ghi mới.'),
        boldLine('2:55 – 3:30 — TC3 Chống trùng. ', 'Thêm hàng mới cùng email đã có trên Bitrix, chưa có Lead ID. Chạy sync. Hệ thống cập nhật lead cũ, không tạo trùng.'),
        boldLine('3:30 – 4:00 — TC4 Lỗi và log. ', 'Nêu (hoặc mô phỏng) một hàng email sai. Hệ thống ghi Lỗi + nguyên nhân, các hàng khác vẫn chạy. Mở nhật ký: tạo / cập nhật / bỏ qua / lỗi.'),
        boldLine('4:00 – 4:25 — Lịch và điểm cộng (rất ngắn). ', 'Nói cron (ví dụ mỗi 15 phút), CLI npm run sync, webhook Bitrix, two-way nếu còn thời gian. Không cần demo hết.'),
        boldLine('4:25 – 4:45 — Kết. ', 'Tóm tắt: mapping linh hoạt, idempotent (Lead ID + hash), retry khi API lỗi. Cảm ơn và để link repo trên slide cuối hoặc mô tả video.'),

        heading('3.3. Những gì bắt buộc phải thấy trong video', HeadingLevel.HEADING_2),
        bullet('Giao diện admin: mapping, trạng thái, log, nút sync tay.'),
        bullet('Tạo lead và cập nhật lead (không chỉ nói suông).'),
        bullet('Chống trùng email/SĐT.'),
        bullet('Log đủ số tạo / cập nhật / bỏ qua / lỗi.'),
        bullet('Không quay file .env, token, webhook, service-account.json.'),

        heading('3.4. Cách quay (Windows)', HeadingLevel.HEADING_2),
        bullet('Windows + G (Xbox Game Bar) → Capture, hoặc OBS Studio.'),
        bullet('Độ phân giải 1280×720 hoặc 1920×1080, nói rõ, zoom browser 125% nếu chữ nhỏ.'),
        bullet('Xuất MP4, dưới 5 phút, dung lượng vừa phải (nên dưới 100–200 MB).'),
        bullet('Đăng YouTube Unlisted / Google Drive (quyền xem cho giám khảo) và dán link vào README hoặc form nộp.'),

        heading('4. Checklist trước khi bấm nộp'),
        bullet('Repo GitHub/GitLab mở được (hoặc đã mời email giám khảo).'),
        bullet('Không có secret trong commit (kiểm tra git log / git ls-files).'),
        bullet('npm test pass.'),
        bullet('Video < 5 phút, đủ TC1–TC3 (nên có TC4), có admin panel.'),
        bullet('README có lệnh chạy và link video.'),
        bullet('Nộp đúng 2 thứ: URL Git + URL video.'),

        heading('5. Câu nói gợi ý khi quay (có thể đọc)'),
        p('“Hệ thống đọc danh sách lead từ Google Sheets, ánh xạ cột sang field Bitrix24, tạo hoặc cập nhật lead. Trước khi tạo mới sẽ kiểm tra trùng email hoặc số điện thoại. Mỗi hàng có trạng thái đồng bộ, Lead ID và log lỗi. Admin cho phép sửa mapping, xem trạng thái, xem nhật ký và chạy sync ngay, ngoài lịch tự động.”'),

        new Paragraph({
          spacing: { before: 360 },
          children: [
            new TextRun({
              text: 'Tài liệu này chỉ phục vụ khâu Submission (Git + video). Chi tiết kỹ thuật xem README.md và docs/ trong repository.',
              italics: true,
              size: 20,
              font: 'Calibri',
              color: '555555',
            }),
          ],
        }),
      ],
    },
  ],
});

const out = join(__dirname, '..', 'Submission-Huong-dan-nop-bai.docx');
Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(out, buffer);
  process.stdout.write(out);
});
