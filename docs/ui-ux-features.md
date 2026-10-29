# Poker Supporter — Tổng hợp chức năng UI/UX người dùng

Tài liệu mô tả toàn bộ những gì người dùng nhìn thấy và thao tác được trong app, theo từng màn hình. Nội dung đối chiếu với code hiện tại (Next.js 16, App Router).

## 1. Vai trò & quyền

| Vai trò | Có thể làm |
|---|---|
| **PLAYER** | Xem dashboard, danh sách session, chi tiết session, danh sách & hồ sơ player. Log session mới. Sửa/xoá session **do chính mình log**. Đổi mật khẩu của mình. |
| **ADMIN** | Mọi quyền của PLAYER + thêm player mới + sửa/xoá **mọi** session. |

- Không có đăng ký công khai — chỉ admin tạo tài khoản (kèm mật khẩu tạm).
- Chưa đăng nhập → mọi URL đều bị chuyển về `/login`. Đã đăng nhập mà vào `/login` → chuyển về `/`.
- Tài khoản bị xoá khỏi DB sẽ mất quyền truy cập ngay cả khi cookie còn hạn.
- Phiên đăng nhập kéo dài **30 ngày**.

## 2. Bố cục chung

**Thanh điều hướng (top bar)** hiển thị trên mọi trang sau đăng nhập:

- `♠ Poker Supporter` (logo, về Dashboard) · `Dashboard` · `Sessions` · `Players` · `+ Log session` (màu xanh, nổi bật).
- Bên phải: **tên hiển thị** của người dùng (link tới trang Account) và nút `Log out`.
- Thanh nav tự xuống dòng (`flex-wrap`) trên màn hình hẹp.

**Quy ước hiển thị:**

- Nội dung giới hạn `max-w-4xl`, căn giữa.
- **Tiền**: lưu dạng cents, hiển thị tối đa 2 chữ số thập phân (vd `50`, `12.5`). Số lãi/lỗ (`Money`) có dấu `+`/`-` và màu: **xanh** = lãi, **đỏ** = lỗ, không màu = hoà. Số dùng `tabular-nums` để thẳng cột.
- **Ngày**: định dạng `en-GB` theo UTC (vd `29 Oct 2026`), trục biểu đồ dùng dạng ngắn (`29 Oct`).
- **Dark mode**: tự động theo cài đặt hệ điều hành (`prefers-color-scheme`), không có nút chuyển thủ công.
- Bảng dữ liệu nằm trong card có `overflow-x-auto` → cuộn ngang trên mobile.

## 3. Đăng nhập — `/login`

- Card nhỏ giữa màn hình: tiêu đề, mô tả "Sign in to see the group's stats.", form `Username` + `Password`.
- Username không phân biệt hoa/thường, tự trim; `autoCapitalize="none"` cho mobile.
- Nút `Sign in` → `Signing in…` và bị disable khi đang gửi.
- Lỗi hiển thị ngay dưới form: `Enter your username.`, `Enter your password.`, `Wrong username or password.`
- Khi sai mật khẩu, **username được giữ lại** trong ô nhập.
- Đăng nhập thành công → chuyển về Dashboard.

## 4. Dashboard — `/`

**Trạng thái rỗng** (chưa có session nào): card "No sessions logged yet." + link `Log the first session →`.

Khi có dữ liệu, gồm 3 phần:

### 4.1 Leaderboard
Bảng xếp hạng theo **Net** giảm dần, cột: `#`, `Player` (link tới hồ sơ), `Net`, `Sessions`, `Win rate` (% session có lãi), `Avg / session`, `Best`, `Worst`. Chỉ liệt kê player đã chơi ít nhất 1 session.

### 4.2 Profit over time (biểu đồ đường, tương tác)
- Mỗi đường là **lợi nhuận cộng dồn** của một player theo từng session; session player không chơi thì giữ nguyên giá trị trước đó.
- Hàng **chip chọn player** phía trên biểu đồ:
  - Mặc định bật **3 player đứng đầu** leaderboard.
  - Bấm chip để bật/tắt; tối đa **5 player** cùng lúc. Khi đủ 5, các chip còn lại bị mờ/disable và hiện gợi ý "Showing 5 players at most. Unselect one to add another."
  - Mỗi player **giữ nguyên màu** khi đang được chọn — bật/tắt người khác không làm đổi màu người cũ.
  - Chip có `aria-pressed` cho screen reader.
- Tooltip khi hover: ngày + từng player (chấm màu, tên, số có dấu), sắp xếp từ cao xuống thấp.
- Có đường tham chiếu tại `0`; hiện chấm điểm dữ liệu khi ≤ 20 session.

### 4.3 Recent sessions
5 session gần nhất dạng **SessionCard** + link `All sessions →`.

**SessionCard** (dùng chung ở Dashboard và Sessions): ngày · địa điểm, số người chơi, tổng buy-in, và người **lãi nhiều nhất** (`Top: <tên> <+số>`). Cả card là link tới chi tiết; viền chuyển xanh khi hover.

## 5. Danh sách session — `/sessions`

- Tiêu đề + link `+ Log session`.
- Toàn bộ session, mới nhất trước, dạng SessionCard. Không phân trang, không lọc/tìm kiếm.
- Trạng thái rỗng: "No sessions logged yet."

## 6. Chi tiết session — `/sessions/[id]`

- Link quay lại `← All sessions`, tiêu đề **ngày · địa điểm**, dòng "Logged by <tên>".
- **Ghi chú** (nếu có) hiển thị trong card riêng.
- Bảng kết quả, sắp xếp theo Net giảm dần: `Player` (link hồ sơ), `Buy-in`, `Cash-out`, `Net`; dòng **Total** ở cuối.
- **Cảnh báo lệch sổ**: nếu tổng cash-out ≠ tổng buy-in → hiện "Cash-outs and buy-ins differ by X, so something may be missing."
- Chỉ admin hoặc người log session mới thấy nút `Edit` và `Delete`.
  - `Delete` mở hộp **confirm của trình duyệt** ("Delete this session? This can't be undone."), khi đang xoá chuyển thành `Deleting…`. Xoá xong quay về danh sách.
- Session không tồn tại → trang 404.

## 7. Log / sửa session — `/sessions/new`, `/sessions/[id]/edit`

Dùng chung một form.

**Thông tin chung:** `Date` (date picker, mặc định **hôm nay theo giờ máy**), `Location` (tuỳ chọn), `Notes` (tuỳ chọn).

**Bảng kết quả (nhập theo dòng):**
- Mỗi dòng: dropdown chọn player (sắp xếp theo tên), ô `Buy-in`, ô `Cash-out` (bàn phím số thập phân trên mobile — `inputMode="decimal"`), nút `✕` xoá dòng.
- Form mới bắt đầu với **2 dòng**, dòng đầu đã chọn sẵn **chính người đang đăng nhập**.
- `+ Add player` thêm dòng.
- **Kiểm tra cân sổ realtime**: dòng "Cash-outs minus buy-ins: ±X" cập nhật khi gõ; nếu ≠ 0 thêm chú thích "(should be 0 if everything is entered)". Đây là cảnh báo, **không chặn** việc lưu.
- Dòng chưa chọn player sẽ bị bỏ qua khi lưu.

**Validate phía server** (hiển thị lỗi dưới form, dữ liệu đã nhập được giữ nguyên):
- `Pick a date.`
- `Row N: enter buy-in and cash-out as numbers.` — số dương, tối đa 2 chữ số thập phân.
- `Add at least two players.`
- `Each player can only appear once.`
- `Unknown player selected.`
- (Sửa) `Only an admin or the person who logged it can change this session.`

Nút submit: `Save session` (mới) / `Save changes` (sửa), hiển thị `Saving…` khi đang gửi. Lưu xong chuyển tới trang chi tiết session.

Vào trang sửa khi không có quyền → bị chuyển về trang chi tiết session.

## 8. Danh sách player — `/players`

- Mỗi player một dòng (cả dòng là link tới hồ sơ): **tên hiển thị**, `@username`, nhãn `· admin` nếu là admin; bên phải là **Net** + số session, hoặc "No sessions yet".
- Sắp xếp theo tên.
- **Chỉ admin** thấy thêm cột bên phải **"Add a player"** (layout 2 cột trên màn hình ≥ md):
  - `Display name` (≤ 40 ký tự), `Username` (3–20 ký tự, chữ thường/số/`_`), `Temporary password` (≥ 8 ký tự, hiển thị dạng text để admin copy gửi bạn).
  - Gợi ý: "Share it with them; they can change it under their name in the top bar."
  - Thành công: thông báo `Added <tên>.` và form tự reset. Lỗi (vd `Username "x" is taken.`) giữ nguyên giá trị đã nhập.

## 9. Hồ sơ player — `/players/[id]`

- `← All players`, tên hiển thị, `@username`.
- Chưa chơi session nào → "No sessions yet."
- **8 ô thống kê** (lưới 2 cột mobile / 4 cột desktop): `Net profit`, `Sessions`, `Win rate`, `Avg / session`, `Best night`, `Worst night`, `Last 5 sessions` (tổng net 5 session gần nhất), `Current streak` (vd "3 wins", "2 losses", hoặc "None"; session hoà sẽ ngắt chuỗi).
- **Profit over time**: biểu đồ đường lợi nhuận cộng dồn (hiện chấm khi ≤ 30 session).
- **Result per session**: biểu đồ cột net từng session — cột **xanh** khi lãi, **đỏ** khi lỗ.
- **History**: bảng mới nhất trước — `Date` (link tới session) · địa điểm, `Buy-in`, `Cash-out`, `Net`, `Running total`.
- Player không tồn tại → 404.

## 10. Tài khoản — `/account`

Vào bằng cách bấm tên mình trên top bar.

- Hiển thị tên + `@username`.
- Form **Change password**: `Current password`, `New password` (≥ 8 ký tự).
- Lỗi: `Enter your current password.`, `New password must be at least 8 characters.`, `Current password is wrong.`
- Thành công: `Password changed.` và form reset.

## 11. Pattern UX dùng xuyên suốt

- **Form**: lỗi/thành công hiển thị inline ngay trên nút submit; nút submit disable + đổi nhãn khi đang gửi; dữ liệu đã nhập không bị mất khi server trả lỗi.
- **Điều hướng ngược**: trang chi tiết luôn có link `← All …`.
- **Liên kết chéo**: tên player ở mọi bảng đều link tới hồ sơ; ngày trong History link tới session.
- **Trạng thái rỗng** được xử lý ở Dashboard, Sessions, Players, hồ sơ player.

## 12. Chưa có (giới hạn hiện tại)

- Không sửa/xoá player, không đổi tên hiển thị, không reset mật khẩu cho người khác.
- Không phân trang, tìm kiếm, lọc theo khoảng thời gian.
- Không có nút chuyển dark/light thủ công.
- Không có đa ngôn ngữ — toàn bộ chữ là tiếng Anh, hardcode.
- Xác nhận xoá dùng `confirm()` native của trình duyệt, không phải modal trong app.
- Không có trang loading/error riêng (`loading.tsx` / `error.tsx`).
