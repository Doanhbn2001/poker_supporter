# Chạy Poker Supporter ở local

Cần có: **Node 22+** và **Docker**. Mọi lệnh chạy từ thư mục gốc của repo (`poker_supporter/`).

## Mỗi lần ngồi code

```bash
./scripts/dev-local.sh        # bật Postgres, migrate + generate + seed, rồi chạy dev server
./scripts/dev-local.sh -p 3001  # nếu cổng 3000 đang bận
```

Script tự tạo container `poker-postgres` nếu chưa có (DB mới thì trống, nạp data ở bước 5 phần dưới). Làm tay thì:

```bash
docker start poker-postgres   # bỏ qua nếu container đã chạy (nó tự bật lại sau reboot)
npm run dev                   # http://localhost:3000
```

Đăng nhập:

| Tài khoản | Mật khẩu |
|---|---|
| `admin` | giá trị `ADMIN_PASSWORD` trong `.env` |
| player tạo bằng `npm run db:import` | giá trị `IMPORT_DEFAULT_PASSWORD` trong `.env` |
| player tạo bằng `npm run db:seed-demo` (data giả) | in ra khi chạy lệnh |

## Setup từ đầu (máy mới / đã xoá DB)

```bash
# 1. Postgres trong Docker. Data nằm ở volume poker-pgdata, xoá container không mất data.
docker run -d --name poker-postgres \
  -e POSTGRES_USER=poker -e POSTGRES_PASSWORD=poker -e POSTGRES_DB=poker \
  -p 5432:5432 -v poker-pgdata:/var/lib/postgresql/data \
  --restart unless-stopped postgres:16-alpine

# 2. Dependency (tự chạy prisma generate)
npm install

# 3. File env: copy rồi điền SESSION_SECRET và ADMIN_PASSWORD
cp .env.example .env
openssl rand -base64 32       # dán kết quả vào SESSION_SECRET

# 4. Tạo bảng + tài khoản admin
npm run db:deploy
npm run db:seed

# 5. (Tuỳ chọn) nạp lịch sử từ Excel, cần file prisma/data/history.json
npm run db:import             # dry run: xem số liệu trước
npm run db:import -- --apply  # ghi thật

# 6. Chạy
npm run dev
```

`DATABASE_URL` mặc định trong `.env.example` (`postgresql://poker:poker@localhost:5432/poker`) khớp sẵn với container ở bước 1.

> `prisma/data/history.json` và `poker.xlsx` bị gitignore (data thật). Clone repo sang máy khác thì phải copy tay 2 file này, không có thì bỏ qua bước 5.

## Sau khi sửa `prisma/schema.prisma`

```bash
npm run db:migrate -- --name <ten_thay_doi>   # tạo + apply migration
npx prisma generate                           # Prisma 7 không tự generate sau migrate
# rồi tắt (Ctrl+C) và chạy lại npm run dev, server cache client cũ
```

Bỏ quên 2 bước cuối thì trang sẽ lỗi 500 kiểu `Unknown field ...`.

## Kiểm tra trước khi commit

```bash
npx tsc --noEmit
npm run lint
```

## Làm lại data local từ đầu

Chỉ xoá session và player, giữ admin, rồi import lại:

```bash
docker exec poker-postgres psql -U poker -c \
  'delete from "Result"; delete from "GameSession"; delete from "User" where role <> '"'"'ADMIN'"'"';'
npm run db:import -- --apply
```

Xoá sạch luôn cả DB (mất hết data local):

```bash
docker rm -f poker-postgres && docker volume rm poker-pgdata
# rồi làm lại "Setup từ đầu" từ bước 1
```

## Lỗi hay gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `port 5432 is already allocated` khi `docker run` | Có Postgres khác đang chiếm 5432. Tắt nó, hoặc đổi `-p 5433:5432` và sửa port trong `DATABASE_URL` |
| `Can't reach database server at localhost:5432` | Container chưa chạy: `docker start poker-postgres` |
| Trang lỗi 500 `Unknown field` / `Unknown argument` | `npx prisma generate` rồi restart `npm run dev` |
| `EADDRINUSE :3000` | Đã có dev server khác đang chạy. Tắt nó, hoặc `npm run dev -- -p 3001` |
| `db:import` báo `Database already has N sessions` | Cố tình chặn để không import trùng. Làm theo mục "Làm lại data local" |
| Bị đá về `/login` liên tục | Cookie cũ không khớp `SESSION_SECRET` mới: xoá cookie `session` của localhost |

## Đẩy lên DB thật (Neon / Vercel)

1. Commit + push lên `BMI`. Vercel tự chạy `migrate deploy` khi build, nên schema lên prod trước.
2. Copy toàn bộ data local lên prod (xoá sạch data prod cũ, chạy trong 1 transaction):
   - Mở file `.env.prod` (đã gitignore), thay `PROD_DATABASE_URL` bằng connection string thật của Neon
     (poker-db → Connect → tắt *Connection pooling* → Copy). Giữ nguyên dấu nháy đơn.
   - Chạy:
     ```bash
     ./scripts/copy-local-to-prod.sh
     ```
   Script dừng nếu migration prod chưa khớp local, in số liệu 2 bên, bắt gõ `yes`, rồi so ví từng người sau khi copy.

**Chỉ làm khi prod chưa có data mới.** Prod đã có người log ván thì đừng chạy lại: mọi thứ trên prod bị thay bằng local.
