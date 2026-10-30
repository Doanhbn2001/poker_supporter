# Đóng góp cho Poker Supporter

Cảm ơn bạn muốn góp sức! App theo dõi các buổi poker của một nhóm bạn: tournament, cash game, quỹ, bảng xếp hạng.
Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma 7 + PostgreSQL.

## 1. Chạy trên máy bạn

Cần **Node 22+** và **Docker**.

```bash
git clone https://github.com/Doanhbn2001/poker_supporter.git
cd poker_supporter
npm install
cp .env.example .env
openssl rand -base64 32          # dán vào SESSION_SECRET trong .env, và tự đặt ADMIN_PASSWORD
./scripts/dev-local.sh           # bật Postgres (Docker), migrate, tạo admin, chạy dev server
```

Mở http://localhost:3000, đăng nhập `admin` với `ADMIN_PASSWORD` bạn vừa đặt.

**Data giả để dev** (repo không chứa data thật của nhóm):

```bash
npm run db:seed-demo             # 8 player demo1..demo8 (mật khẩu demo1234), 20 tournament, 10 cash game
```

Chi tiết hơn và cách xử lý lỗi hay gặp: [docs/local-setup.md](docs/local-setup.md).
Kiến trúc và quy ước code: [CLAUDE.md](CLAUDE.md) (đọc trước khi sửa, đặc biệt phần auth, tiền tính bằng cent, ngày lưu UTC).

## 2. Quy trình

1. Fork repo (hoặc tạo nhánh nếu bạn là collaborator), đặt tên nhánh theo việc: `feature/create-table`, `fix/fund-total`.
2. Code, rồi chạy đủ 3 lệnh trước khi mở PR:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
3. Đổi schema (`prisma/schema.prisma`) thì tạo migration: `npm run db:migrate -- --name <ten>` rồi `npx prisma generate`,
   commit cả thư mục migration mới.
4. Mở **Pull Request vào nhánh `BMI`**, mô tả làm gì và test thế nào (ảnh chụp nếu đổi giao diện).
5. Maintainer review rồi merge. **`BMI` là nhánh production**: merge xong là Vercel tự deploy, nên mọi thay đổi đều qua PR.

## 3. Quy tắc

- **Không commit** `.env`, `.env.prod`, file Excel, `prisma/data/`, dump DB, mật khẩu hay connection string thật.
  Repo là public: thứ gì đã lên git thì coi như lộ vĩnh viễn.
- Mọi page và server action phải gọi `requireUser()` / `requireAdmin()` (`src/lib/dal.ts`), không tin vào `proxy.ts`.
- Tiền là số nguyên **cent**; dùng `toCents()` / `formatMoney()`. Mỗi ván phải có tổng buy-in = tổng cash-out.
- Giữ code giống phong cách xung quanh: server component đọc data, client component chỉ cho form / tương tác / chart.
- Chữ trên giao diện: tiêu đề và nút bằng tiếng Anh, phần giải thích dài có thể bằng tiếng Việt.
