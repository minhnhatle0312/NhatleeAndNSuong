# Đối chiếu yêu cầu vieccanlam.md — v3

Các yêu cầu bổ sung và giao diện phiên bản 3 được ghi chi tiết tại [experience-v3.md](experience-v3.md).

Tất cả nhóm chức năng trong yêu cầu đã có mã nguồn và đường dẫn giao diện. Danh sách này mô tả phạm vi đã triển khai, không phải kết quả kiểm thử. Theo yêu cầu, chưa chạy kiểm thử chức năng hay trên hai thiết bị.

| Yêu cầu | Triển khai |
| --- | --- |
| Trang chủ, hai hồ sơ, dấu cộng ghép đôi, ngày sinh, cung, trái tim và số ngày | Tổng quan; sinh nhật/ngày đặc biệt sắp tới được tính từ hồ sơ và sự kiện. |
| Đăng ký/đăng nhập/hồ sơ | Cookie phiên, scrypt, ảnh đại diện, giới tính, giới quan tâm, sinh nhật, bio, đổi mật khẩu, mã mời dùng một lần. |
| Tâm trạng/caption/selfie/đối phương thấy | Camera trực tiếp hoặc chọn ảnh; 8 cảm xúc, lịch sử, quyền chia sẻ. |
| Sức khỏe và chu kỳ nữ | Nhật ký riêng/chung, triệu chứng, ngày bắt đầu/độ dài kỳ, lịch tháng và ước tính kỳ tiếp theo; tình trạng sức khỏe hồ sơ có đồng ý chia sẻ. |
| Vị trí hai chiều/khoảng cách/tốc độ | Bật/tắt đồng ý, GPS khi trang mở, chỉ hiện đối phương khi cả hai bật, ẩn dữ liệu cũ sau 15 phút. |
| Nhiều vòng quay/chỉnh lựa chọn/lịch sử/ngẫu nhiên | CRUD bộ quay, chọn ngẫu nhiên trên máy chủ, hiệu ứng 5 giây và lịch sử theo bộ. |
| Chat trực tuyến/ảnh/video/gọi video/màu chung | Tin nhắn được lưu; tệp, emoji, voice note, typing, màu chung, WebRTC thoại/video, nhận/từ chối/kết thúc. |
| Nhiều thú cưng/chăm sóc/cấp/thưởng/âm thanh | 12 loài SVG với bộ phận chuyển động riêng, 6 bối cảnh, 6 hoạt động, hứng sao hai người, XP/cấp/xu/tủ đồ và âm thanh tổng hợp. |
| Trò chơi chung | Caro, tic tac toe, lật thẻ và oẳn tù tì với lượt/kết quả do máy chủ quyết định. |
| Lịch biểu hai người/trạng thái nhanh | Lịch tháng, riêng/chung, giờ, lịch lặp, địa điểm; trạng thái hiện tại theo lịch và trạng thái hồ sơ. |
| Romantic/3D/chuyển động/mobile | Trái tim CSS nhiều lớp, chuyển động/hover, vector pet, responsive desktop/tablet/mobile, tối, reduced motion. |
| Liên kết các trang và dữ liệu lâu dài | Tài khoản → cặp đôi → không gian; một database SQLite, Socket.IO đồng bộ và Docker bind mounts. |
| Tính năng bổ sung | Khoảnh khắc, nhật ký, điều ước, quà, thử thách, chi phí, địa điểm, thư tương lai, thống kê, JSON export, PWA và nhập dữ liệu cũ. |

## Cần cấu hình môi trường khi đưa lên Internet

- Dockerfile/Compose/Caddy đã chuẩn bị. Chưa xuất bản lên Internet; cần máy chủ/tên miền truy cập được.
- Gọi điện qua mạng khác nhau có thể cần STUN/TURN. Trình duyệt phải được cấp quyền mic/camera trên localhost hoặc HTTPS.
- Vị trí dùng API thiết bị; không suy diễn tốc độ nếu trình duyệt không cung cấp. Không theo dõi khi trang đã đóng.
- Lịch chu kỳ chỉ là ước tính. Không có chẩn đoán y khoa hoặc dự báo ngày an toàn.
- Thư tương lai được khóa nội dung ở API đến ngày hẹn; dữ liệu riêng tư không được service worker cache.
- Không có email reset/OAuth/cloud push/đồng bộ Google Calendar trong phạm vi yêu cầu gốc. Không dùng backend SQL cũ cho giao diện v2.
