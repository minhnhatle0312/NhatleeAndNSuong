# Chạy và triển khai Chuyện hai mình v3

Phiên bản 3 dùng lại dữ liệu và cấu hình triển khai hiện có. Sau khi cập nhật mã, chạy `docker compose -p chuyen-hai-minh up -d --build app`, rồi tải lại trang bằng Ctrl+F5. Chi tiết các trang mới tại [experience-v3.md](experience-v3.md).

## Cục bộ

Chạy `npm start`, mở http://localhost:3000. Mặc định chỉ lắng nghe `127.0.0.1`. SQLite và các tệp được lưu lâu dài tại `data/` và `uploads/`. Không cần SQL Server hoặc khóa API để xem giao diện và dùng các chức năng chính.

Hai tài khoản trên cùng máy: một trình duyệt thường và một cửa sổ riêng tư, hoặc hai hồ sơ trình duyệt. Đăng ký mỗi người một tài khoản rồi dùng mã ghép đôi trong hồ sơ.

Để nghe/gọi hoặc chụp selfie phải cấp quyền camera/mic. Định vị phải cấp quyền GPS. Localhost là ngữ cảnh trình duyệt hỗ trợ các quyền này; địa chỉ IP HTTP của máy trong LAN có thể không được phép dùng camera/GPS.

## Docker trên máy hiện có

Docker Compose tạo duy nhất dịch vụ ứng dụng; không sửa, xóa hoặc tái sử dụng cơ sở dữ liệu của Keycloak/Postgres đang có.

```powershell
docker compose -p chuyen-hai-minh up -d --build app
docker compose -p chuyen-hai-minh logs -f app
```

Mở http://localhost:3000. Dừng bản `npm start` trước khi chuyển sang container cùng cổng.

- Gắn `./data:/app/data` và `./uploads:/app/uploads`; không xóa các thư mục này khi cập nhật.
- Image Node 22 dùng SQLite tích hợp, không cần một database service bên ngoài.
- Image chỉ cài phụ thuộc của ứng dụng SQLite hiện tại; các driver SQL cũ không còn nằm trong gói chạy v2.
- Chỉ chạy một replica ứng dụng. Socket.IO/signaling và trạng thái cuộc gọi đang lưu trong RAM của replica đó.

## Tên miền và HTTPS

Trên máy chủ có DNS trỏ đúng về địa chỉ của máy, cho phép cổng 80/443 và đặt biến trong `.env`:

```dotenv
APP_DOMAIN=hai-minh.example.com
COOKIE_SECURE=true
TRUST_PROXY=1
```

Thay tên miền ví dụ bằng tên miền thật rồi chạy:

```powershell
docker compose -p chuyen-hai-minh --profile https up -d --build
```

Profile Caddy tự xin chứng chỉ cho tên miền có thể xác minh. Caddy chuyển tiếp HTTP/WebSocket đến `app:3000`; cổng ứng dụng trên máy chủ vẫn chỉ mở ở loopback. `COOKIE_SECURE=true` dùng với HTTPS; để `false` khi xem HTTP localhost.

Docker trên một máy không tự tạo địa chỉ Internet. Nếu máy nằm sau router/NAT, cần cấu hình đường vào/tunnel và DNS của máy chủ trước khi người ở mạng khác truy cập được. Chưa có thông tin tên miền hoặc hạ tầng truy cập công khai trong yêu cầu này.

## Gọi thoại/video

WebRTC signaling chạy trong Socket.IO theo cặp đã xác thực. Media truyền giữa hai trình duyệt, ứng dụng không ghi lại cuộc gọi.

Máy chủ trả danh sách ICE server qua `/api/rtc-config`. Mặc định danh sách trống để dùng kết nối trực tiếp khi mạng cho phép. Khi đi qua Internet/NAT, nhập dịch vụ ICE của bạn trong `.env`:

```dotenv
STUN_URL=stun:stun.ten-mien-cua-ban:3478
TURN_URL=turn:turn.ten-mien-cua-ban:3478
TURN_USERNAME=ten-nguoi-dung
TURN_PASSWORD=mat-khau-turn
```

Các giá trị trên chỉ là ví dụ. TURN nên dùng thông tin xác thực giới hạn phạm vi và thời gian; bản hiện tại cung cấp cấu hình ICE cho tài khoản đã đăng nhập. Dùng HTTPS và kiểm tra thực tế hai mạng khi chuẩn bị phát hành.

## Sao lưu và chuyển máy

Dừng ứng dụng khi sao chép backup để bản SQLite và các tệp tải lên nhất quán. Giữ cả thư mục `data/` (gồm SQLite/WAL nếu còn) và `uploads/`. Bản xuất JSON trong giao diện là bản sao nội dung nhìn thấy của tài khoản, không thay thế backup máy chủ và không chứa mật khẩu/phiên.

Các bảng cũ được giữ nguyên. Tài khoản đăng ký đầu tiên được quyền nhập dữ liệu cũ một lần trong **Hồ sơ → Dữ liệu & tài khoản**. Nếu dữ liệu cũ đang ở SQL Server, cần chuyển các bảng/tệp tương ứng sang SQLite trước; ứng dụng v2 hiện dùng SQLite và không đồng bộ trực tiếp với SQL Server/Azure SQL.

## Các biến khác

| Biến | Mặc định | Công dụng |
| --- | --- | --- |
| `PORT` | `3000` | Cổng chạy Node / cổng được công bố ở loopback cho Compose. |
| `HOST` | `127.0.0.1` | Địa chỉ Node lắng nghe; Compose đặt `0.0.0.0` trong container. |
| `DATA_DIR` | `./data` | Vị trí SQLite khi chạy Node trực tiếp. |
| `UPLOAD_DIR` | `./uploads` | Vị trí tệp khi chạy Node trực tiếp. |
| `COOKIE_SECURE` | `false` | Chỉ gửi cookie qua HTTPS khi bật. |
| `TRUST_PROXY` | `0` | Số reverse proxy đáng tin cậy; profile Caddy dùng `1`. |

Các thông tin đăng nhập trong `.env` không được đưa vào image hoặc frontend. `.env` đang có được giữ nguyên.
