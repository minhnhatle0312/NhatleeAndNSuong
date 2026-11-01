# Chuyện hai mình · NhatLee & NSuong

Phiên bản 3 bổ sung các trải nghiệm trong `bosungyeucau.md` và nâng cấp frontend toàn hệ thống. Xem [các trang và hoạt họa mới](docs/experience-v3.md): 12 loài thú cưng có bộ phận chuyển động riêng, 6 bối cảnh, hứng sao chung, bản đồ kỷ niệm, mục tiêu/chi phí, 30 ngày thử thách, thư giọng nói, reels ghép có nhạc, góc tâm sự, cây tình yêu, huy hiệu và phòng xem phim đồng bộ.

Ứng dụng dành cho hai người, giao diện tiếng Việt, thiết kế màu kem/hồng trầm, trái tim 3D bằng CSS và thú cưng vector có chuyển động. Dùng Express, Socket.IO và SQLite tích hợp trong Node.js; mọi dữ liệu nghiệp vụ được lưu tại máy chủ.

## Mở ứng dụng trên Internet

Link `github.com/minhnhatle0312/NhatleeAndNSuong` là kho mã nguồn và hiển thị README, không phải địa chỉ ứng dụng. App có máy chủ Node.js, SQLite và Socket.IO nên cần hosting chạy backend; GitHub Pages chỉ phục vụ trang tĩnh.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fminhnhatle0312%2FNhatleeAndNSuong)

Đã có [render.yaml](render.yaml) để tạo một Web Service ở Singapore và ổ lưu trữ bền vững cho tài khoản, tin nhắn, ảnh/video. **Cấu hình này dùng dịch vụ trả phí và ổ đĩa 1 GB**; xem chi phí trong Render trước khi xác nhận. Sau khi deploy thành công, mở URL HTTPS do Render cấp trong trang dịch vụ. Xem [hướng dẫn Render](docs/deployment.md#render--link-app-online).

Trên điện thoại, mở URL của app bằng Safari/Chrome rồi chọn **Thêm vào màn hình chính** hoặc **Cài đặt ứng dụng** nếu trình duyệt hỗ trợ. Dự án đã có PWA để mở ở cửa sổ riêng; đăng nhập, đồng bộ và chat vẫn cần Internet.

## Mở trên máy

Yêu cầu Node.js 22.13 trở lên. Nếu đã có `node_modules` thì không cần cài lại.

```powershell
npm install
npm start
```

Mở **http://localhost:3000**. `npm run dev` tự khởi động lại khi sửa máy chủ.

1. Chọn **Tạo tài khoản**, cập nhật hồ sơ, ảnh đại diện, ngày sinh và giới tính.
2. Vào **Hồ sơ & ghép đôi → Mời người thương**, tạo mã dùng một lần trong 24 giờ.
3. Người còn lại đăng ký tài khoản riêng bằng trình duyệt khác hoặc cửa sổ riêng tư, rồi nhập mã. Không dùng hai tab cùng phiên để đăng nhập hai tài khoản vì cookie được dùng chung.
4. Chỉnh ngày bắt đầu yêu trong hồ sơ. Tâm trạng, lịch, chat, trò chơi và thú cưng đồng bộ trong không gian của hai bạn.

Tài khoản đầu tiên có thể chọn **Nhập dữ liệu phiên bản cũ** trong hồ sơ để đưa những kỷ niệm đã có vào không gian mới. Các bảng dữ liệu cũ không bị xóa.

## Những chức năng đã viết

- Đăng ký, đăng nhập, đăng xuất, đổi mật khẩu, phiên đăng nhập bằng cookie HttpOnly; mật khẩu băm scrypt. Hồ sơ có ảnh, sinh nhật, giới tính, giới quan tâm, cung hoàng đạo, trạng thái nhanh và tình trạng sức khỏe.
- Ghép đôi bằng mã mời, tên không gian, ngày bắt đầu bên nhau, tách đôi với quy tắc giữ dữ liệu theo người tạo. API và tệp được giới hạn theo không gian và quyền chia sẻ.
- Trang chủ: hai hồ sơ, dấu cộng mời ghép đôi, trái tim nổi, số ngày/giờ/phút, ngày đặc biệt sắp tới, tâm trạng, lịch hôm nay, trạng thái hiện tại, điều ước và thú cưng.
- Nhật ký cảm xúc có tám cảm xúc, caption, ảnh selfie từ camera hoặc chọn tệp, lịch sử bảy ngày và chọn quyền chia sẻ.
- Nhật ký sức khỏe riêng tư mặc định; tùy chọn chia sẻ, triệu chứng, tình trạng trên hồ sơ. Hồ sơ nữ có ngày bắt đầu kỳ, độ dài chu kỳ, số ngày hành kinh và lịch tháng phân biệt ngày đã ghi với ngày ước tính.
- Vị trí có bật/tắt, cập nhật và theo dõi khi trang mở; chỉ hiện tọa độ đối phương khi cả hai bật. Khoảng cách đường thẳng, sai số GPS, tốc độ thiết bị cung cấp và liên kết OpenStreetMap. Tọa độ cũ hơn 15 phút được ẩn.
- Vòng quay: tạo nhiều bộ 2–30 lựa chọn, chỉnh sửa/xóa, kết quả ngẫu nhiên từ máy chủ bằng `crypto.randomInt`, hiệu ứng quay và lịch sử theo bộ.
- Chat trực tiếp: lưu tin nhắn, ảnh/video/âm thanh, thu âm, emoji, chỉ báo đang nhập, tùy chỉnh màu nền/chữ dùng chung, gọi thoại/video WebRTC có nhận/từ chối, mic/camera và kết thúc cuộc gọi.
- Mười hai loài thú cưng: mèo, cún, thỏ, cáo, gấu trúc, rồng, chim cánh cụt, gấu, hamster, rái cá, kỳ lân và hươu. Chăm ăn, tắm, chơi, đi dạo, ngủ, ôm; bộ phận chuyển động riêng, 6 bối cảnh, hứng sao chung, tủ đồ, XP/cấp/xu, nhật ký và âm thanh tổng hợp.
- Bốn trò chơi hai người thời gian thực: caro 15×15, tic tac toe, lật 8 cặp thẻ, oẳn tù tì. Máy chủ kiểm tra lượt, kết quả và che thẻ/lựa chọn bí mật.
- Lịch tháng: lịch riêng/chia sẻ, giờ bắt đầu/kết thúc, lặp hằng ngày/hằng tuần, địa điểm, trạng thái theo hoạt động. Sự kiện năm, sinh nhật tự lấy từ hồ sơ, đếm ngày sắp tới.
- Ảnh/video kỷ niệm, xem phóng to, tải tệp, tìm kiếm, lọc; nhật ký chung, quà, thử thách, điều ước, chi phí, địa điểm muốn đến, thư tương lai khóa đến ngày mở; thống kê sáu tháng và hành trình.
- Mobile sidebar/bottom navigation, chế độ tối, giảm chuyển động theo thiết bị, PWA, xuất dữ liệu JSON. Service worker chỉ lưu vỏ ứng dụng, không lưu API, phiên hay tệp riêng tư.

## Docker và đưa lên Internet

```powershell
docker compose -p chuyen-hai-minh up -d --build app
```

Chạy ứng dụng Node trực tiếp **hoặc** Docker; dừng tiến trình chiếm cổng 3000 trước khi chuyển cách chạy. `data/` và `uploads/` được gắn vào container để dữ liệu còn nguyên khi tạo lại container. Docker này độc lập với các container Keycloak/Postgres khác trên máy.

Để truy cập từ Internet có thể dùng Render theo hướng dẫn ở trên, hoặc máy chủ riêng với profile Caddy HTTPS trong [hướng dẫn triển khai](docs/deployment.md). Render cấp địa chỉ HTTPS, không cần mua tên miền riêng. Gọi điện qua các mạng khác nhau có thể cần STUN/TURN do bạn cấu hình.

## Cấu trúc và dữ liệu

- `src/server/couple.js`: API tài khoản, cặp đôi, dữ liệu, trò chơi, WebRTC signaling.
- `public/index.html`, `public/assets/js/couple.js`, `public/assets/css/couple.css`: giao diện hiện tại.
- `data/memories.sqlite`: cả bảng cũ và các bảng `love_*` mới; `uploads/`: tệp được xác thực quyền truy cập qua API.
- `compose.yaml`, `Dockerfile`, `infra/Caddyfile`: chạy bằng Docker và reverse proxy HTTPS.
- `src/server/server.js`, `infra/sql/`, các tệp CSS/JS giao diện trước: giữ lại để tham khảo/chuyển dữ liệu; không thuộc luồng chạy phiên bản 2. Backend SQL cũ không có xác thực và không được dùng để phục vụ giao diện mới.

Đã kiểm tra cục bộ với cấu hình production: khởi động máy chủ, health check, phục vụ giao diện/PWA, Socket.IO, đăng ký với cookie HTTPS và giữ tài khoản/phiên sau khi khởi động lại. Kiểm tra dùng dữ liệu tạm riêng. Chưa xác minh triển khai thực tế trên Render hoặc gọi điện trên hai thiết bị/hai mạng.
