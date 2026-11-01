# Các trải nghiệm bổ sung — phiên bản 3

Triển khai theo `bosungyeucau.md`, bổ sung vào hệ thống tài khoản, cặp đôi và cơ sở dữ liệu hiện có. Giữ nguyên các tài khoản và tệp đã lưu. Đây là mô tả mã nguồn đã triển khai, không phải báo cáo kiểm thử chức năng.

## Giao diện và hoạt họa

- Nâng lại typography, màu sắc, độ tương phản, kích thước nội dung, trang chủ, thanh điều hướng, biểu mẫu, nhật ký, sức khỏe, lịch, chat và các trang trò chơi hiện có. Chữ dùng sans-serif, giảm chữ trang trí và tiêu đề tiếng Anh.
- Trang chủ mới có hai hồ sơ, trạng thái từ lịch, bộ đếm đến giây, trái tim nhiều lớp chuyển động, khu vườn thú cưng, cảm xúc nhanh, lịch sắp tới và các lối vào trải nghiệm mới.
- Thú cưng được vẽ lại thành nhân vật SVG có đầu, tai, thân, tay, chân, đuôi, mắt và phụ kiện chuyển động riêng. Không dùng một hình đứng yên phóng to/thu nhỏ cho mọi hành động.
- 12 loài: mèo, cún, thỏ, cáo, gấu trúc, rồng, chim cánh cụt, gấu, hamster, rái cá, kỳ lân và hươu. Nhận nuôi, đổi tên, vuốt ve, nhìn theo con trỏ và hoạt cảnh ăn/tắm/ngủ/đi dạo/chơi bóng/ôm.
- 6 bối cảnh mua bằng xu: đồng cỏ, phòng ấm, bờ biển, rừng, xứ tuyết và vũ trụ. Có ngày/đêm, mây, sao, cây đung đưa, hoa, ánh sáng, bong bóng, bóng đổ và vật dụng tương tác.
- Tủ đồ gồm nơ, hoa, khăn, kính và vương miện. Vật phẩm đã mua có thể dùng lại. Chỉ số, kinh nghiệm, cấp độ và xu lưu ở máy chủ.
- Minigame hứng 28 ngôi sao: hai người cùng tham gia một lượt chơi trong 30 giây; máy chủ kiểm tra thời điểm xuất hiện, lượt bắt và trao thưởng một lần.
- Responsive desktop/tablet/mobile, điều hướng dưới cùng và chế độ tối. Khi thiết bị yêu cầu giảm chuyển động, các hoạt ảnh được giảm hoặc tắt.

## Các trang mới

| Đường dẫn | Nội dung |
| --- | --- |
| `/#map` | Bản đồ kỷ niệm có kéo, thu/phóng, tọa độ GPS tự chọn, ghim, ảnh/video, câu chuyện, cảm xúc và album liên kết từ khoảnh khắc. Bản đồ dùng tile OpenStreetMap, giữ attribution và cache mặc định của trình duyệt. |
| `/#bucket` | Danh sách ước mơ, tiến độ, lọc đang làm/đã hoàn thành, ngày dự định. Hoàn thành có hiệu ứng chúc mừng; ảnh/video chứng minh được tự thêm vào khoảnh khắc. |
| `/#wallet` | Heo đất theo mục tiêu, đóng góp của từng người, lịch sử chi phí, phân loại, biểu đồ và ghi nhận chia hóa đơn. Đây là sổ ghi chép, không chuyển tiền thật. |
| `/#challenges` | Hành trình 30 ngày, mỗi ngày mở một thử thách, ghi lời nhắn hoàn thành, nhận 25 điểm vun đắp và 15 xu chung. Máy chủ chặn ngày chưa mở và phần thưởng trùng. |
| `/#capsules` | Thư tương lai có ảnh/video/giọng nói và thu âm trực tiếp; khóa đến ngày hẹn hoặc mở sớm sau khi cả hai nhập mật khẩu chung. Nội dung, tệp và hash mật khẩu được ẩn khỏi trạng thái gửi cho trình duyệt khi thư còn khóa. |
| `/#reels` | Video tối đa 30 giây, ghép ảnh/video đã lưu theo tháng, chuyển cảnh, nhạc tổng hợp, xuất video bằng MediaRecorder rồi lưu lại. Thả tim và bình luận gắn với thời điểm phát, bấm mốc thời gian để xem lại. |
| `/#safe` | Tâm sự, xin lỗi, biết ơn, thư bất ngờ và bài tập viết ba điều trân trọng để gửi làm lành. Có tùy chọn ẩn tên trên giao diện; không hứa ẩn danh tuyệt đối trong một cặp đôi hai người. |
| `/#garden` | Cây tình yêu 5 giai đoạn, điểm từ hoạt động, tưới mỗi ngày, cảnh mùa theo tháng, lá/hoa/gió và lịch sử điểm. |
| `/#badges` | 12 huy hiệu với tiến độ từ dữ liệu thật, nhận xu và điểm một lần khi đủ điều kiện. Không suy đoán hoặc gán nhãn “không giận dỗi” khi không có dữ liệu xác thực. |
| `/#cinema` | Video tải lên hoặc YouTube qua IFrame Player API; chia sẻ trạng thái phát/dừng/tua giữa hai tài khoản, danh sách buổi hẹn, rạp sao và hai nhân vật ngồi sofa. Có lối gửi ôm và gọi video. |

## Liên kết giữa các phần

- Cảm xúc buồn được chia sẻ → gợi ý ôm/gọi trong chat và thay đổi cách bé thú cưng biểu cảm.
- Bản ghi sức khỏe được đồng ý chia sẻ → tạo nhắc lịch hỏi thăm, thêm ngày chu kỳ dự kiến nếu có. Khi chuyển riêng tư hoặc xóa bản ghi, nhắc lịch liên quan được gỡ.
- Vòng quay → lịch sử, xu/điểm giới hạn theo ngày và nút lưu kết quả thành lịch hẹn.
- Hoàn thành điều ước/thử thách/lịch → điểm vun đắp; ảnh hoàn thành điều ước → khoảnh khắc.
- Chat/cảm xúc/khoảnh khắc/game → điểm cây; huy hiệu/thử thách → quỹ xu; xu → tủ đồ và bối cảnh thú cưng.
- Dữ liệu thử thách, huy hiệu và phần thưởng được giữ khi ghép hai không gian đã có lịch sử; bản trùng được lưu trữ hoặc đổi khóa phù hợp.

## Điều kiện sử dụng

- Giữ tab mở trong khi ghép video. MediaRecorder/canvas capture phụ thuộc trình duyệt; video được tạo thực sự, không phải bản xem trước giả lập. Khuyến nghị dùng trình duyệt Chromium khi cần xuất WebM.
- Nhạc ghép do Web Audio tạo trong trình duyệt. Không tự tải nhạc hoặc phim có bản quyền từ các dịch vụ bên ngoài.
- YouTube và bản đồ cần Internet. Video YouTube có thể bị chủ sở hữu chặn nhúng. Chính sách autoplay có thể yêu cầu mỗi người bấm “Phát chung” lần đầu.
- Gọi mic/camera tiếp tục dùng WebRTC hiện có; qua Internet cần HTTPS và có thể cần STUN/TURN.
- Ngày tháng dùng múi giờ thiết bị ở frontend và Asia/Bangkok tại máy chủ như phiên bản trước.
- Dữ liệu nghiệp vụ vẫn dùng SQLite bền vững trong Docker, các mô-đun backend/frontend được tách file. Các đề xuất chuyển sang React/PostgreSQL/Redis và mở rộng nhiều replica chưa được thực hiện trong lần nâng cấp giao diện này.

Theo yêu cầu trước đó, không chạy bộ kiểm thử chức năng, không giả lập hai người dùng hay can thiệp tài khoản thật để thử tính năng. Chỉ kiểm tra cú pháp, dựng image và xác nhận localhost phục vụ được.
