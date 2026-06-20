# 📊 Phân Tích Tiến Độ Dự Dự Án: FamilyCare Agent

Tài liệu này đánh giá hiện trạng mã nguồn của dự án **FamilyCare Agent** đối chiếu với đề bài cuộc thi, chỉ rõ các phần đã hoàn thành, các khoảng trống kỹ thuật cần lấp đầy và đề xuất lộ trình chi tiết để hoàn thiện ứng dụng sẵn sàng cho việc demo/nộp bài.

---

## 🗺️ Kiến Trúc Hệ Thống (Mục Tiêu)

Dự án được cấu trúc theo dạng Monorepo sử dụng **Turborepo** và **pnpm Workspaces** để quản lý đồng thời ứng dụng Web (Next.js), REST API (Express) và AI Agent (Python + MCP).

```
                     ┌────────────────────────────────────────┐
                     │          FAMILYCARE MONOREPO           │
                     └───────────────────┬────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│      apps/web        │      │       apps/api       │      │       python/        │
│    (Next.js App)     │      │   (Express Backend)  │      │  (AI Agent & MCP)    │
├──────────────────────┤      ├──────────────────────┤      ├──────────────────────┤
│ 👤 UI cho Ba/Mẹ      │      │ 🔒 Anonymizer        │      │ 🧠 Gemini AI Agent   │
│   - Check-in nhanh   │ ◄──► │ 📁 localStore (JSON) │ ◄──► │ 🔌 MCP Servers       │
│   - Nhận diện giọng  │      │ ✉️ Gửi Email (Resend)│      │   - Đọc/ghi JSON     │
│ 👥 UI cho Con        │      │ 🔌 Cầu nối Python    │      │   - Xử lý alerts     │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘
```

---

## ✅ Những Phần Đã Hoàn Thành (Done)

Dự án đã có một nền tảng Backend vững chắc đi theo định hướng **Privacy-First** cùng một giao diện cơ bản phía Ba/Mẹ.

### 1. Thư viện chia sẻ kiểu dữ liệu (`packages/shared`)

- **Chi tiết:** Định nghĩa đầy đủ toàn bộ cấu trúc dữ liệu (`types`) sử dụng chung cho cả TypeScript Backend (`apps/api`) và Frontend (`apps/web`).
- **Các kiểu dữ liệu chính:** `UserProfile`, `CheckIn`, `Alert`, `DailyReport`, `AgentRequest`, `AgentResponse`... đảm bảo tính toàn vẹn và an toàn kiểu dữ liệu (Type-safe).

### 2. Express API Backend (`apps/api`) — Đã di chuyển sang Privacy-First 🔒

Để đáp ứng tiêu chí **Security & Privacy**, toàn bộ hệ thống cơ sở dữ liệu cloud (Prisma + Neon DB) đã được loại bỏ và thay thế bằng lưu trữ cục bộ:

- [localStore.ts](file:///d:/STUDY/learn_google/familycare-agent/apps/api/src/lib/localStore.ts): Module chuyên dụng đọc/ghi dữ liệu check-in (`data/checkins.json`) và cảnh báo (`data/alerts.json`) dưới dạng file JSON cục bộ.
- [anonymizer.ts](file:///d:/STUDY/learn_google/familycare-agent/apps/api/src/lib/anonymizer.ts): Tự động phát hiện và loại bỏ các dữ liệu định danh (PII) như email, số điện thoại, tên riêng trước khi gửi yêu cầu sang AI Agent để đảm bảo sự riêng tư tuyệt đối cho người lớn tuổi.
- [checkin.ts](file:///d:/STUDY/learn_google/familycare-agent/apps/api/src/routes/checkin.ts): Nhận tin nhắn check-in từ ba mẹ, kích hoạt bộ ẩn danh, gọi AI Agent phân tích, lưu dữ liệu xuống máy local và kích hoạt cảnh báo nếu phát hiện bất thường.
- [alerts.ts](file:///d:/STUDY/learn_google/familycare-agent/apps/api/src/routes/alerts.ts): Quản lý vòng đời của cảnh báo (Danh sách, Đánh dấu đã đọc, Xử lý/Resolve).
- [reports.ts](file:///d:/STUDY/learn_google/familycare-agent/apps/api/src/routes/reports.ts) & [email.ts](file:///d:/STUDY/learn_google/familycare-agent/apps/api/src/services/email.ts): Tạo báo cáo sức khỏe ngày/tuần và gửi thông báo email cho con cái qua dịch vụ **Resend**.
- [pythonAgent.ts](file:///d:/STUDY/learn_google/familycare-agent/apps/api/src/services/pythonAgent.ts): Cầu nối gọi HTTP API sang Python Agent chạy ở port 8000 (đang sử dụng mock-fallback khi chưa có Python server).

### 3. Giao diện Phía Ba/Mẹ (`apps/web`)

- [setup/page.tsx](file:///d:/STUDY/learn_google/familycare-agent/apps/web/src/app/setup/page.tsx): Trang thiết lập ban đầu (Tên, tuổi, số điện thoại của ba mẹ và con cái) lưu trực tiếp vào LocalStorage của trình duyệt.
- [parent/page.tsx](file:///d:/STUDY/learn_google/familycare-agent/apps/web/src/app/parent/page.tsx): Trang check-in chính trực quan với:
  - Nhập câu check-in bằng chữ hoặc ghi âm giọng nói.
  - Các trạng thái nhanh: Mệt mỏi 😫, Bình thường 🙂, Rất khỏe 😊.
  - Nút khẩn cấp SOS cảnh báo ngay lập tức cho con cái.

---

## ❌ Những Phần Còn Thiếu & Cần Hoàn Thiện (ToDo)

Đây là các phần quan trọng nhất của đề bài mà dự án cần bổ sung để ghi điểm trước ban giám khảo:

### 1. AI Agent thông minh bằng Python (`python/agents/`) 🧠

- **Trạng thái hiện tại:** Thư mục trống. API Express đang phải sử dụng Mock Response tạm thời.
- **Mục tiêu:** Tạo file `python/agents/health_agent.py` chạy dịch vụ FastAPI ở cổng `8000`.
- **Yêu cầu kỹ thuật:**
  - Tích hợp SDK Gemini (`google-generativeai`) hoặc LangChain/CrewAI để giao tiếp với mô hình LLM.
  - Sử dụng Prompt Engineering phù hợp để AI có thể hiểu được ngữ cảnh sức khỏe người già, nhận diện các trạng thái tinh thần và thể chất qua các câu check-in ngắn của ba mẹ.
  - Quản lý ngữ cảnh phiên hội thoại (`session`) để biết ba mẹ đang nói về buổi sáng hay buổi tối, hoặc liên hệ với các triệu chứng của ngày hôm trước.

### 2. Tích hợp MCP Server (`python/mcp_servers/`) 🔌

- **Trạng thái hiện tại:** Chưa triển khai.
- **Mục tiêu:** Xây dựng MCP Server `python/mcp_servers/health_mcp.py` theo giao thức **Model Context Protocol** do Anthropic đề xuất.
- **Yêu cầu kỹ thuật:**
  - Định nghĩa và đăng ký các **MCP Tools** cho phép AI Agent tương tác an toàn với hệ thống file local:
    - `read_checkins(date)`: Đọc lịch sử sức khỏe.
    - `write_checkin(data)`: Ghi nhận check-in mới.
    - `read_alerts()` & `create_alert(data)`: Xem/Tạo cảnh báo.
    - `generate_report(date)`: Tổng hợp dữ liệu thành báo cáo sức khỏe.
  - **Cách thức vận hành:** AI Agent sẽ không trực tiếp can thiệp vào file JSON mà thông qua các Tools này để đọc/ghi, thể hiện đúng mô hình AI Agent có khả năng suy luận và hành động (Reasoning & Acting - ReAct).

### 3. Trang Dashboard dành cho Con (`apps/web/src/app/child/`) 👥

- **Trạng thái hiện tại:** Chưa có router `/child/` trong Next.js.
- **Mục tiêu:** Tạo giao diện quản lý dành cho con cái để theo dõi từ xa:
  - **Alert Feed:** Nhận tức thời các cảnh báo màu đỏ/vàng khi ba mẹ gặp bất thường (như té ngã, đau ngực, quên uống thuốc). Có nút "Đánh dấu đã đọc" hoặc "Đã xử lý".
  - **Health Logs:** Xem lịch sử check-in của ba mẹ theo dòng thời gian.
  - **Health Reports:** Biểu đồ hóa hoặc hiển thị báo cáo chi tiết theo ngày/tuần được tổng hợp từ AI Agent.

### 4. Tài liệu hướng dẫn & Demo video 📝

- **README.md:** Hiện tại file README gốc ở thư mục cha vẫn là cấu trúc mặc định của Turborepo. Cần viết lại tài liệu chi tiết mô tả kiến trúc Privacy-First, các MCP Tools, cách chạy dự án và cách cấu hình các API Key (Gemini, Resend).

---

## 🗺️ Lộ Trình Triển Khai Tiếp Theo

Dưới đây là kế hoạch 4 bước cụ thể để hoàn thiện dự án:

### Bước 1: Thiết lập Python FastAPI Server (`python/agents/health_agent.py`)

1. Khởi tạo môi trường ảo Python (venv) và file `python/requirements.txt`.
2. Tạo ứng dụng FastAPI cơ bản định nghĩa 2 endpoint chính:
   - `GET /health`: Kiểm tra sức khỏe của Python Server.
   - `POST /chat`: Nhận cấu trúc `AgentRequest` và trả về `AgentResponse`.
3. Tích hợp Gemini API để thay thế chức năng phân tích triệu chứng giả định.

### Bước 2: Tích hợp MCP Server (`python/mcp_servers/health_mcp.py`)

1. Cài đặt thư viện MCP SDK (`mcp` hoặc `mcp-python-sdk`).
2. Viết MCP Server khai báo các công cụ (Tools) tương tác với file dữ liệu local (`apps/api/data/*`).
3. Liên kết AI Agent với MCP Server để Agent sử dụng MCP Tools thực thi hành động đọc/ghi dữ liệu.

### Bước 3: Hoàn thiện Dashboard cho Con (`apps/web/src/app/child/page.tsx`)

1. Tạo trang Dashboard UI với phong cách thiết kế hiện đại, cao cấp (dùng CSS thuần, bố cục Flexbox/Grid, hỗ trợ Responsive trên Mobile & Desktop).
2. Tích hợp Axios client ([api.ts](file:///d:/STUDY/learn_google/familycare-agent/apps/web/src/lib/api.ts)) để fetch dữ liệu cảnh báo và lịch sử check-in thời gian thực.
3. Thêm các chức năng gửi mail báo cáo thủ công và cập nhật trạng thái cảnh báo.

### Bước 4: Kiểm thử toàn diện & Đóng gói Demo

1. Sử dụng công cụ Postman (đã có [postman_guide.md](file:///C:/Users/trung%20tin/.gemini/antigravity-ide/brain/75455a35-491f-42f2-a750-a9670eaae1c4/postman_guide.md)) để chạy thử nghiệm các tình huống:
   - _Check-in Khỏe:_ AI nhận diện trạng thái tích cực, không gửi cảnh báo.
   - _Check-in Mệt:_ AI nhận diện triệu chứng (ví dụ: đau đầu), gửi cảnh báo mức độ nhẹ/trung bình.
   - _Check-in SOS / Nguy cấp:_ AI kích hoạt ngay lập tức cảnh báo màu đỏ (emergency), gửi email tức thời cho con cái qua Resend.
2. Hoàn thiện tài liệu README.md và chuẩn bị kịch bản demo chạy thực tế trên máy cục bộ.

---

## 📊 Đánh Giá So Với Tiêu Chỉ Cuộc Thi

| Tiêu Chỉ Đề Bài                           | Mức Độ Đáp Ứng Hiện Tại | Đánh Giá Kỹ Thuật                                                                         | Hành Động Cần Thiết                                                                            |
| :---------------------------------------- | :---------------------- | :---------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **Giải quyết vấn đề thực tế**             | 🟢 Tốt (100%)           | Ý tưởng chăm sóc ba mẹ từ xa rất thiết thực và có ý nghĩa xã hội.                         | Không cần điều chỉnh ý tưởng.                                                                  |
| **AI Agent (Suy luận & Hành động)**       | 🟡 Trung bình (40%)     | Hiện tại chỉ sử dụng giải thuật Regex/Mock đơn giản ở phía Express.                       | Phải đưa LLM thật (Gemini) vào phía Python Agent để xử lý ngôn ngữ tự nhiên.                   |
| **Tích hợp MCP (Model Context Protocol)** | 🔴 Chưa có (0%)         | Chưa có module MCP Server hay cấu hình kết nối.                                           | **Bắt buộc** triển khai MCP Server bằng Python và đăng ký các công cụ tương tác dữ liệu local. |
| **Security & Privacy**                    | 🟢 Tốt (95%)            | Kiến trúc Privacy-First lưu local và anonymizer hoạt động tốt.                            | Đảm bảo các MCP tools cũng tuân thủ việc xử lý dữ liệu đã ẩn danh.                             |
| **Demo & Triển khai thực tế**             | 🟡 Trung bình (50%)     | Giao diện ba mẹ và backend chạy tốt, nhưng thiếu dashboard cho con và tài liệu hướng dẫn. | Thiết lập dashboard cho con cái và chuẩn bị kịch bản demo chạy thực tế trên máy cục bộ.        |

> [!IMPORTANT]
> **MCP (Model Context Protocol) và AI Agent thật** là 2 yếu tố cốt lõi của đề thi. Chúng ta cần dồn toàn lực hoàn thiện thư mục `python/` ở bước tiếp theo để đảm bảo dự án đủ điều kiện dự thi và đạt điểm tối đa.
