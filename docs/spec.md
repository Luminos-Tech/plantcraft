# 📋 BẢN ĐẶC TẢ KỸ THUẬT – PLANTCRAFT
### Ứng dụng Web AR Chăm Sóc Cây Thật × Trang Trí Ảo × Gamification
**Phiên bản:** 1.0 | **Dự án:** TDTU Vibe Coding 2026 | **Stack:** React + WebXR + Gemini API

---

## 1. TỔNG QUAN SẢN PHẨM

### 1.1 Mô tả một dòng
PlantCraft là một **Progressive Web App (PWA) mobile-first** cho phép người dùng chăm sóc cây thật, chẩn đoán bệnh lá bằng AI Vision, và trang trí cây bằng các vật phẩm voxel 3D (phong cách Minecraft) thông qua Augmented Reality — tất cả chạy hoàn toàn trên trình duyệt, không cần cài app.

### 1.2 Core Value Proposition
Thay vì mô phỏng tăng trưởng ảo (quá chậm → người dùng bỏ cuộc), PlantCraft dùng cơ chế **reward ngay lập tức**: chăm sóc cây thật → nhận Green Coins → mua vật phẩm 3D → trang trí lên cây qua AR. Vòng lặp gamification này tạo ra thói quen chăm cây bền vững.

### 1.3 Target Platform
- **Trình duyệt:** Chrome 111+ (Android), Safari 16+ (iOS) — cần hỗ trợ WebXR Device API
- **Thiết bị:** Smartphone có camera sau (ưu tiên Android ARCore / iOS ARKit)
- **Không cần backend** ở giai đoạn MVP — dùng LocalStorage + Gemini API key phía client
- **Môi trường mở rộng:** Trường học (THCS, THPT, Đại học) tích hợp vào hoạt động ngoại khóa, câu lạc bộ môi trường, tiết Sinh học thực hành.

### 1.4 User Segments — Phân Khúc Người Dùng Mở Rộng

PlantCraft phục vụ hai nhóm người dùng với nhu cầu khác nhau nhưng cùng dùng một core product:

**Nhóm 1 — Cá nhân (Consumer):** Người trẻ đô thị 18–30 tuổi yêu cây cảnh indoor, gamer casual bị thu hút bởi voxel art và cơ chế thu thập vật phẩm. Động lực chính: phần thưởng tức thì, tính thẩm mỹ cá nhân hóa, cảm giác tiến bộ qua XP/level.

**Nhóm 2 — Giáo dục (Education):** Học sinh THCS–THPT và sinh viên tham gia chương trình trồng cây tại trường, giáo viên Sinh học muốn số hóa hoạt động thực hành chăm cây của lớp. Động lực chính: học kiến thức thực vật học qua trải nghiệm thực tế, thi đua nhóm/lớp, hoàn thành nhiệm vụ học tập có chấm điểm.

Hai nhóm dùng cùng app nhưng có **luồng trải nghiệm khác nhau** — xem chi tiết tại mục 9 (Education Mode).

---

## 2. KIẾN TRÚC TỔNG THỂ

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            PlantCraft PWA                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  React UI    │  │ Filter Engine│  │  AI Vision   │  │  QR Anchor   │ │
│  │  (Lovable/v0)│  │  (TF.js +   │  │  (Gemini     │  │  Layer       │ │
│  │              │  │  Canvas 2D)  │  │   2.5 Flash) │  │  (jsQR)      │ │
│  │ - Dashboard  │  │ - COCO-SSD  │  │ - Phân tích  │  │ - QR gen     │ │
│  │ - Shop       │  │   detect cây │  │   ảnh lá     │  │ - QR scan    │ │
│  │ - Camera     │  │ - Draw items │  │ - JSON bệnh  │  │ - Canvas     │ │
│  │ - Scan Friend│  │ - HUD overlay│  │ - reward()   │  │   overlay    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                  │                 │         │
│  ┌──────▼─────────────────▼──────────────────▼─────────────────▼────────┐│
│  │                State Manager (TypeScript + LocalStorage)              ││
│  │    { plants[], inventory[], coins, xp, placedItems[] }               ││
│  └───────────────────────────────────────┬───────────────────────────────┘│
│                                          │ sync (chỉ khi Public Mode bật)│
│  ┌───────────────────────────────────────▼───────────────────────────────┐│
│  │              Firebase Realtime Database (Phase 3)                     ││
│  │  plantcraft-public/{ownerUid}/{plantId} → { name, hp, placedItems }  ││
│  └───────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Tech Stack Chi Tiết

| Layer | Công nghệ | Lý do chọn |
|---|---|---|
| UI Framework | React 18 + TypeScript | Type-safe, component-driven |
| Styling | Tailwind CSS | Mobile-first utility classes |
| Camera Feed | `getUserMedia` Web API | Có sẵn trên mọi trình duyệt, không cần WebXR |
| Plant Detection | TensorFlow.js + COCO-SSD | Class "potted plant" có sẵn trong 80 class; chạy hoàn toàn on-device |
| Item Overlay | Canvas 2D API | Vẽ overlay nhẹ, tốc độ cao; không cần WebGL/3D engine |
| Item Assets | PNG sprite sheets (pixel art) | Nhẹ hơn GLTF, render nhanh trên Canvas 2D |
| AI Vision | Google Gemini 2.5 Flash API | Multimodal, hỗ trợ phân tích ảnh lá |
| QR Generation | `qrcode` (npm) | Tạo QR SVG/PNG phía client, không cần server |
| QR Scan | `jsQR` (npm) | Đọc nội dung QR từ video frame, nhẹ ~24KB |
| Realtime Sync | Firebase Realtime Database | Sync HP + items giữa nhiều thiết bị theo thời gian thực |
| State | Zustand + LocalStorage sync | Đơn giản, persist tự động |
| Build | Vite | Dev server nhanh, lazy-load TF.js model |

> **Tại sao bỏ A-Frame + WebXR?** WebXR hit-test yêu cầu ARCore/ARKit — chỉ hoạt động trên một số thiết bị cụ thể, không test được trên laptop, lỗi silent khó debug. Filter style dùng `getUserMedia` + Canvas hoạt động trên 100% thiết bị có camera, test được ngay trên DevTools, và vibe code được dễ dàng hơn nhiều.

> **Tại sao bỏ MindAR.js?** MindAR cần compile file `.mind` từ ảnh tĩnh — không phù hợp với QR động (mỗi cây khác nhau). `jsQR` đơn giản hơn, nhẹ hơn, và đủ để lấy plantId + tính vị trí overlay tương đối với bounding box của QR.

---

## 3. GIAI ĐOẠN 1 — THIẾT KẾ UI (Dùng cho Lovable / v0)

### 3.1 Design System

**Phong cách:** "Cottagecore Tối Giản" × "Minecraft Pixel Icon"
- Nền: `#F5F0E8` (kem nhạt) cho cảm giác ấm, tự nhiên
- Accent: `#5C8A3C` (xanh lá rừng), `#E8C547` (vàng pixel)
- Font heading: `Press Start 2P` (Google Fonts — pixel font)
- Font body: `Inter` (dễ đọc trên mobile)
- Border radius card: `4px` (vuông-góc, giữ vibe Minecraft)
- Icon style: 16×16 pixel art SVG, không dùng icon tròn mềm

### 3.2 Cấu Trúc Navigation

```
App Shell
├── /dashboard              (màn hình mặc định)
├── /shop                   (cửa hàng vật phẩm)
├── /camera                 (Filter Camera: trang trí + AI scan)
├── /scan-friend            (Shared AR: quét QR + xem filter cây bạn)
└── /plant/:plantId/qr      (hiển thị QR code của cây để chia sẻ)
```

Navigation bar dưới cùng (bottom nav), 4 icon pixel: 🌿 Vườn | 🏪 Shop | 📷 Camera | 🔍 Quét bạn.

> **Lý do tách `/camera` và `/scan-friend`:** `/camera` là filter cá nhân — COCO-SSD detect cây của owner để đặt item. `/scan-friend` là filter cộng đồng — jsQR đọc QR để fetch data bạn bè từ Firebase, sau đó render items lên bất kỳ cây nào đang trong khung hình. Hai use case khác nhau về mục đích và data source, nên tách route rõ ràng hơn.

### 3.3 Màn Hình 1 — Dashboard (Vườn của tôi)

**Layout tổng thể:** Scroll dọc, 1 cột trên mobile

**Header:** Logo "PlantCraft" font pixel + hiển thị `💰 {coins} GC` + `⭐ LV {level}`

**Section 1 — Plant Cards:**
Mỗi cây là một card `w-full rounded-sm border-2 border-[#5C8A3C] bg-white p-3`.

Card chứa:
- Ảnh thumbnail cây (do user chụp lúc thêm cây) — `64x64px` hình vuông, object-fit: cover
- Tên cây (tối đa 20 ký tự, font pixel nhỏ)
- HP Bar: `div` có background gradient từ đỏ → xanh, width = `{hp}%`
  - HP Bar phải có animation `transition-all duration-500` khi thay đổi
  - HP được tính theo công thức: `hp = 100 - (daysSinceLastWatered * 10)`; nếu hp < 20 thì bar chớp đỏ (animation `pulse`)
- Badge trạng thái: "💧 Cần tưới" / "✅ Khỏe mạnh" / "🚨 Bệnh!" dạng pill nhỏ
- Button "AR Trang Trí" → navigate sang `/camera?plantId={id}`

**Section 2 — Quick Actions:**
Row 2 nút lớn, full-width:
- Button "➕ Thêm cây mới" → mở modal nhập tên + chụp ảnh
- Button "📋 Lịch sử chăm sóc" → bottom sheet cuộn

**Empty State:** Khi chưa có cây, hiển thị minh họa pixel art một chậu cây trống kèm text "Thêm cây đầu tiên của bạn!" và nút CTA xanh lá.

### 3.4 Màn Hình 2 — Shop (Cửa hàng vật phẩm)

**Header:** "🏪 Item Shop" + balance hiện tại

**Filter Tabs (ngang, scroll được):**
```
[Tất cả] [🎩 Mũ] [👓 Kính] [🟦 Blocks] [✨ VFX] [🔒 Hiếm]
```

**Item Grid:** 2 cột trên mobile, mỗi item card gồm:
- Preview 3D render (ảnh PNG isometric của voxel model, `80x80px`)
- Tên item (font pixel)
- Giá: `💰 {price} GC`
- Badge "MỚI" màu vàng nếu `createdAt < 7 ngày`
- Badge "HIẾM" màu tím nếu `rarity === 'rare'`
- Button "Mua" — disabled + opacity 50% nếu không đủ tiền
- Button "Trang bị" — hiển thị nếu đã sở hữu item

**Item detail bottom sheet:** Khi tap vào card → bottom sheet trượt lên hiển thị:
- Ảnh lớn hơn của item (có xoay 360° bằng CSS animation)
- Mô tả ngắn (ví dụ: "Mũ cỏ Minecraft — vật phẩm phổ biến nhất mùa xuân")
- Button "Mua ngay" hoặc "Đã sở hữu"

### 3.5 Màn Hình 3 — Camera Filter

**Full screen layout** — không có navigation bar.

**Cấu trúc DOM — đơn giản hơn WebXR rất nhiều:**

```
<div class="camera-screen">           ← container full screen
  <video id="camera-feed">            ← camera feed (muted, autoplay)
  <canvas id="filter-canvas">         ← overlay canvas, same size as video
                                          (z-index cao hơn video)
  <div id="filter-hud">               ← React UI controls (z-index cao nhất)
    <div id="hud-top">                ← tên cây + HP bar
    <div id="hud-bottom">             ← item carousel + scan button
  </div>
</div>
```

Canvas và video được stack lên nhau bằng CSS `position: absolute; top: 0; left: 0`. Canvas có `pointer-events: none` để touch event pass-through xuống video/div bên dưới.

**Kỹ thuật quan trọng — Tại sao không cần WebXR nữa:**

Thay vì A-Frame + WebXR session phức tạp, toàn bộ "AR" chỉ là một vòng lặp `requestAnimationFrame` đơn giản:

```typescript
// Vòng lặp chính — chạy 30fps, chỉ 5 dòng logic cốt lõi
async function filterLoop(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const ctx    = canvas.getContext('2d')!;
  const model  = await cocoSsd.load();   // load model một lần duy nhất

  const loop = async () => {
    // 1. Detect "potted plant" trong frame hiện tại
    const predictions = await model.detect(video);
    const plant = predictions.find(p => p.class === 'potted plant');

    // 2. Xóa canvas frame cũ
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 3. Nếu có cây → vẽ items lên đúng vị trí
    if (plant) drawItems(ctx, plant.bbox, activePlantItems);

    // 4. Lặp lại frame tiếp theo
    requestAnimationFrame(loop);
  };
  loop();
}
```

**HUD Tên Cây + HP Bar (vẫn giữ nguyên thiết kế):**

`position: fixed; top: 0` — không cần DOM Overlay của WebXR nữa vì đây là HTML thông thường. CSS `position: fixed` đặt trên cùng là đủ:

```tsx
// ARPlantHUD — vẫn đọc từ Zustand store, logic không đổi
// Nhưng giờ render như HTML bình thường, không cần WebXR session
const hpColor = plant.hp >= 70 ? '#4CAF50' : plant.hp >= 40 ? '#FFC107' : '#F44336';
```

HP bar, màu sắc theo ngưỡng, animation pulse khi HP < 20 — tất cả giữ nguyên thiết kế từ mục 3.5 trước, chỉ bỏ ràng buộc `dom-overlay` của WebXR.

**Thanh Công Cụ Dưới (hud-bottom):**

Item carousel ngang scroll được, thumb 48×48px PNG sprite (thay GLTF). Item đang chọn có border vàng. Button "🔍 Quét bệnh AI" xanh lá lớn. Tap item trong carousel → `setSelectedItem(itemId)` → `drawItems()` trong filter loop sẽ tự động vẽ item đó lên canvas.

**Hướng dẫn overlay:** Lần đầu dùng, hiện text "👆 Hướng camera vào chậu cây" fade in/out ở giữa canvas. Biến mất khi COCO-SSD detect được "potted plant" lần đầu.

**Cấu trúc DOM tổng thể của màn hình AR:**

```
<div class="ar-screen">          ← container bọc toàn bộ
  <a-scene ...>                  ← WebXR scene (camera feed + 3D items)
  </a-scene>

  <div id="ar-overlay">          ← ĐÂY LÀ HUD — float lên trên a-scene
    <div id="ar-hud-top">        ← Thanh HUD phía trên
    <div id="ar-hud-bottom">     ← Thanh công cụ phía dưới
  </div>
</div>
```

**UI Overlay — Thanh HUD Phía Trên (ar-hud-top):**

Thanh này luôn hiển thị trong suốt phiên AR, kể cả khi người dùng di chuyển điện thoại. Layout: `position: fixed; top: 0; left: 0; right: 0; padding: 12px 16px; background: rgba(0,0,0,0.35); backdrop-filter: blur(4px)`.

Hàng trên của HUD gồm: nút "✕" top-left để đóng AR (quay về dashboard), tên cây ở giữa (font pixel, text-shadow trắng để đọc được trên mọi nền), và badge HP dạng pill bên phải (`💚 {hp}/100`).

Hàng dưới của HUD là HP Bar toàn chiều rộng — đây là điểm mấu chốt vì người dùng cần thấy ngay tình trạng cây trong khi quét camera:

```tsx
// Component ARPlantHUD — đọc state trực tiếp từ Zustand store
// Không cần props vì plantId đã có trong URL params
const ARPlantHUD: React.FC = () => {
  const plantId = useParams().plantId;
  const plant = useGameStore(s => s.plants.find(p => p.id === plantId));

  if (!plant) return null;

  // Màu HP bar thay đổi theo ngưỡng — giúp người dùng đọc trạng thái cực nhanh
  const hpColor =
    plant.hp >= 70 ? '#4CAF50' :  // xanh lá — khỏe mạnh
    plant.hp >= 40 ? '#FFC107' :  // vàng — cần chú ý
    '#F44336';                     // đỏ — khẩn cấp

  return (
    <div
      id="ar-hud-top"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(4px)',
        padding: '12px 16px',
        fontFamily: '"Press Start 2P", monospace',
      }}
    >
      {/* Hàng 1: nút đóng + tên cây + HP số */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <button onClick={closeAR} style={{ color: 'white', fontSize: 18 }}>✕</button>
        <span style={{
          flex: 1, textAlign: 'center', color: 'white',
          fontSize: 11, textShadow: '0 1px 3px rgba(0,0,0,0.8)'
        }}>
          🌿 {plant.name}
        </span>
        <span style={{
          fontSize: 10, color: hpColor, fontWeight: 'bold',
          // Chớp đỏ khi HP < 20 để cảnh báo khẩn cấp
          animation: plant.hp < 20 ? 'pulse 1s infinite' : 'none'
        }}>
          ♥ {plant.hp}
        </span>
      </div>

      {/* Hàng 2: HP Bar toàn chiều rộng */}
      <div style={{
        height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.2)',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${plant.hp}%`,
          background: hpColor,
          borderRadius: 4,
          // Transition mượt khi HP thay đổi (ví dụ sau khi tưới nước)
          transition: 'width 0.6s ease, background-color 0.4s ease',
          // Gradient để trông "sống động" hơn flat color
          backgroundImage: `linear-gradient(90deg, ${hpColor}99, ${hpColor})`,
        }} />
      </div>
    </div>
  );
};
```

**UI Overlay — Thanh Công Cụ Phía Dưới (ar-hud-bottom):**

`position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 16px; background: rgba(0,0,0,0.35); backdrop-filter: blur(4px)`.

Item carousel ngang: scroll được, mỗi thumb 48×48px có border vàng sáng khi đang chọn. Button "🔍 Quét bệnh AI" nổi bật màu `#5C8A3C`, cỡ lớn, luôn visible. Loading state: spinner pixel + text "AI đang phân tích..." Success state: flash xanh + hiện modal kết quả.

**Hướng dẫn overlay:** Lần đầu dùng, hiện text animation "👆 Chạm lên cây để đặt vật phẩm" fade in/out ở giữa màn hình (bên trong `#ar-overlay`, z-index thấp hơn HUD).

---

## 4. GIAI ĐOẠN 2 — FILTER ENGINE (Dùng cho Cursor)

> **Thay đổi kiến trúc:** Toàn bộ WebXR + A-Frame + hit-test được thay bằng TensorFlow.js COCO-SSD + Canvas 2D API. Lý do: đơn giản hơn 10 lần, test được ngay trên laptop, không phụ thuộc ARCore/ARKit, hoạt động trên 100% thiết bị có camera.

### 4.1 Luồng Kỹ Thuật Tổng Thể

```
getUserMedia() → <video> element (fullscreen)
      │
      ▼ mỗi frame (requestAnimationFrame ~30fps)
TF.js COCO-SSD model.detect(video)
      │
      ├── Không thấy "potted plant" → clearRect(), hiện hướng dẫn
      │
      └── Thấy "potted plant" → bbox: [x, y, width, height]
                │
                ▼
         drawItems(ctx, bbox, selectedItems[])
                │
         Với mỗi item, tính vị trí trên canvas
         theo qrRelative offset đã lưu
                │
                ▼
         ctx.drawImage(itemSprite, drawX, drawY, drawW, drawH)
```

### 4.2 Khởi Tạo Camera và Model

**File:** `src/filter/filter-engine.ts`

```typescript
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs-backend-webgl';  // GPU acceleration

export class FilterEngine {
  private model:   cocoSsd.ObjectDetection | null = null;
  private video:   HTMLVideoElement;
  private canvas:  HTMLCanvasElement;
  private ctx:     CanvasRenderingContext2D;
  private rafId:   number = 0;
  private isRunning = false;

  // Cache sprite images để không load lại mỗi frame
  private spriteCache: Map<string, HTMLImageElement> = new Map();

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    this.video  = video;
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d')!;
  }

  async init(): Promise<void> {
    // Khởi động camera
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      // facingMode: 'environment' = camera sau trên điện thoại
    });
    this.video.srcObject = stream;
    await this.video.play();

    // Căn canvas khớp với video
    this.canvas.width  = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;

    // Load COCO-SSD model — chỉ load một lần, cache lại
    // Model size: ~6MB, load ~1-2s trên wifi, hiện spinner trong lúc chờ
    this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    // 'lite_mobilenet_v2': nhỏ hơn (~3MB), phù hợp mobile; accuracy đủ dùng
  }

  start(getItems: () => PlacedItem[]): void {
    this.isRunning = true;
    const loop = async () => {
      if (!this.isRunning) return;

      // Detect objects trong frame hiện tại
      const predictions = await this.model!.detect(this.video);

      // Tìm "potted plant" với confidence cao nhất
      const plant = predictions
        .filter(p => p.class === 'potted plant')
        .sort((a, b) => b.score - a.score)[0];

      // Xóa canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (plant) {
        this.drawDetectionFeedback(plant.bbox);   // visual feedback
        this.drawItems(plant.bbox, getItems());   // vẽ items của user
      } else {
        this.drawNoPlantHint();  // "Hướng camera vào cây..."
      }

      this.rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  stop(): void {
    this.isRunning = false;
    cancelAnimationFrame(this.rafId);
    // Stop camera stream
    const stream = this.video.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
  }
}
```

### 4.3 Tọa Độ Vật Phẩm — Bounding Box Relative

Đây là thay thế hoàn toàn cho hệ tọa độ `worldToLocal()` của WebXR. Thay vì lưu tọa độ 3D phức tạp, ta lưu vị trí item theo **tỉ lệ tương đối với bounding box của cây**.

```typescript
// Thay thế cho interface PlacedItem cũ — đơn giản hơn nhiều
interface PlacedItem {
  id:     string;   // uuid v4
  itemId: string;   // key trong ITEM_REGISTRY
  plantId: string;

  // Vị trí tương đối với bounding box của cây — KHÔNG phụ thuộc thiết bị
  // anchorX: 0 = cạnh trái box, 1 = cạnh phải box, 0.5 = giữa
  // anchorY: 0 = cạnh trên box, 1 = cạnh dưới box, -0.3 = 30% trên đầu box
  anchorX:     number;
  anchorY:     number;
  // Scale tương đối với chiều rộng box — item sẽ to/nhỏ theo kích thước cây trên màn hình
  scaleRatio:  number;  // 0.4 = rộng bằng 40% chiều rộng bbox

  isShared:    boolean;
  placedAt:    number;
}

// Ví dụ vị trí mặc định cho từng loại item:
const ITEM_DEFAULT_ANCHOR: Record<string, { anchorX: number; anchorY: number; scaleRatio: number }> = {
  hat:     { anchorX: 0.5, anchorY: -0.25, scaleRatio: 0.45 }, // trên đầu cây
  glasses: { anchorX: 0.5, anchorY: 0.25,  scaleRatio: 0.40 }, // 1/4 từ trên xuống
  block:   { anchorX: 0.8, anchorY: 0.6,   scaleRatio: 0.30 }, // góc phải dưới
  vfx:     { anchorX: 0.5, anchorY: 0.5,   scaleRatio: 0.90 }, // overlay toàn cây
};
```

**Tại sao cách này hoạt động tốt cho Shared AR:**

Khi viewer quét QR và mở camera, cây của họ có thể ở khoảng cách khác, nhưng bounding box của COCO-SSD luôn scale theo kích thước cây trên màn hình. Vị trí anchor `(0.5, -0.25)` luôn có nghĩa "trên đầu cây, chính giữa" — bất kể cây gần hay xa, điện thoại nào. Đây đơn giản hơn và thực ra còn tự nhiên hơn `worldToLocal()` vì nó tự động thích nghi với kích thước cây thật của viewer.

### 4.4 Hàm drawItems() — Trái Tim Của Filter

```typescript
// Trong class FilterEngine
private async drawItems(
  bbox: [number, number, number, number],  // [x, y, width, height] từ COCO-SSD
  items: PlacedItem[]
): Promise<void> {
  const [bx, by, bw, bh] = bbox;

  for (const item of items) {
    // Tính vị trí pixel thực trên canvas từ anchor tỉ lệ
    const drawW = bw * item.scaleRatio;
    const drawH = drawW;  // giữ tỉ lệ 1:1 cho sprite vuông
    const drawX = bx + bw * item.anchorX - drawW / 2;  // center theo anchorX
    const drawY = by + bh * item.anchorY - drawH / 2;  // center theo anchorY

    // Load sprite từ cache hoặc fetch lần đầu
    const sprite = await this.getSprite(item.itemId);

    // Vẽ item sprite lên canvas — đây là toàn bộ "AR rendering"
    this.ctx.drawImage(sprite, drawX, drawY, drawW, drawH);

    // Optional: vẽ shadow nhẹ để item trông "dính" vào cây hơn
    this.ctx.shadowColor   = 'rgba(0,0,0,0.3)';
    this.ctx.shadowBlur    = 8;
    this.ctx.shadowOffsetY = 4;
  }

  // Reset shadow sau khi vẽ xong
  this.ctx.shadowColor = 'transparent';
}

private async getSprite(itemId: string): Promise<HTMLImageElement> {
  if (this.spriteCache.has(itemId)) return this.spriteCache.get(itemId)!;

  const img = new Image();
  img.src = ITEM_REGISTRY[itemId].spritePath;  // PNG với transparent background
  await img.decode();
  this.spriteCache.set(itemId, img);
  return img;
}

private drawDetectionFeedback(bbox: [number, number, number, number]): void {
  const [x, y, w, h] = bbox;
  // Vẽ viền xanh nhạt quanh cây được detect — giúp user biết app đang "thấy" cây
  this.ctx.strokeStyle = 'rgba(92, 138, 60, 0.6)';  // màu xanh lá app
  this.ctx.lineWidth   = 2;
  this.ctx.setLineDash([8, 4]);  // đường nét đứt pixel art style
  this.ctx.strokeRect(x, y, w, h);
  this.ctx.setLineDash([]);
}
```

### 4.5 Đặt Vật Phẩm — Tap Để Chọn Vị Trí

Người dùng tap vào canvas để đặt item. Tọa độ tap được convert sang anchor tỉ lệ:

```typescript
// Trong FilterScreen component
function handleCanvasTap(event: React.TouchEvent | React.MouseEvent): void {
  const rect   = canvasRef.current!.getBoundingClientRect();
  const tapX   = ('touches' in event ? event.touches[0].clientX : event.clientX) - rect.left;
  const tapY   = ('touches' in event ? event.touches[0].clientY : event.clientY) - rect.top;

  // Cần biết bbox hiện tại của cây — lưu bbox từ frame gần nhất vào ref
  const bbox = lastDetectedBboxRef.current;
  if (!bbox) {
    showHint('Hãy hướng camera vào cây trước');
    return;
  }

  const [bx, by, bw, bh] = bbox;

  // Convert tọa độ tap sang anchor tỉ lệ
  const anchorX    = (tapX - bx) / bw;
  const anchorY    = (tapY - by) / bh;
  const scaleRatio = ITEM_DEFAULT_ANCHOR[selectedItemCategory]?.scaleRatio ?? 0.35;

  const newItem: PlacedItem = {
    id:          uuidv4(),
    itemId:      selectedItemId,
    plantId:     activePlantId,
    anchorX,
    anchorY,
    scaleRatio,
    isShared:    plant.isPublic,
    placedAt:    Date.now(),
  };

  // Lưu vào store → filter loop sẽ tự động render item trong frame tiếp theo
  useGameStore.getState().savePlacedItem(activePlantId, newItem);

  // Sync lên Firebase nếu cây đang public
  if (plant.isPublic) {
    syncPlacedItemToFirebase(activePlantId, auth.currentUser!.uid, newItem)
      .catch(err => console.warn('Firebase sync failed:', err));
  }
}
```

### 4.6 Item Assets — PNG Sprite Thay GLTF

Bỏ GLTF 3D models, chuyển sang PNG sprites với transparent background. PNG dễ tạo hơn nhiều (dùng Canva, Piskel, hay even Midjourney với `--no-background`), render nhanh trên Canvas 2D, và vẫn giữ được phong cách pixel art Minecraft.

**Cấu trúc thư mục assets mới:**

```
public/assets/
├── sprites/
│   ├── hat_grass.png          # 256x256px, pixel art, transparent bg
│   ├── glasses_sunflower.png
│   ├── block_diamond.png
│   ├── vfx_butterflies.png
│   └── crown_gold.png
└── (không còn /models/ GLTF)
```

**Cập nhật ITEM_REGISTRY** — thay `gltfPath` bằng `spritePath`:

```typescript
'hat_grass': {
  id:          'hat_grass',
  name:        'Mũ Cỏ Xanh',
  category:    'hat',
  rarity:      'common',
  price:       50,
  spritePath:  '/assets/sprites/hat_grass.png',  // ← thay gltfPath
  previewImagePath: '/assets/previews/hat_grass.png',
  unlockedByDefault: true,
  defaultAnchor: { anchorX: 0.5, anchorY: -0.25, scaleRatio: 0.45 },
},
```

### 4.7 Compatibility Check — Đơn Giản Hơn Nhiều

```typescript
// Không cần check WebXR nữa — chỉ cần camera
async function checkCameraSupport(): Promise<'ok' | 'no-camera'> {
  if (!navigator.mediaDevices?.getUserMedia) return 'no-camera';
  try {
    // Thử xin permission camera — nếu user từ chối thì catch
    await navigator.mediaDevices.getUserMedia({ video: true });
    return 'ok';
  } catch {
    return 'no-camera';
  }
}
// 'ok'        → mount FilterScreen bình thường
// 'no-camera' → hiện thông báo "Vui lòng cho phép truy cập camera"
// Không còn trường hợp 'none' do thiếu WebXR — mọi thiết bị đều OK
```

### 4.8 Prompt Cho Cursor — Filter Engine

```
"Tạo FilterEngine cho PlantCraft dùng TensorFlow.js COCO-SSD và Canvas 2D.
Không dùng WebXR, A-Frame, hay bất kỳ AR library nào.

BƯỚC 1 — Setup:
npm install @tensorflow/tfjs @tensorflow-models/coco-ssd
Tạo src/filter/filter-engine.ts với class FilterEngine.
init(): getUserMedia({facingMode:'environment'}), gán srcObject vào <video>,
load cocoSsd.load({base:'lite_mobilenet_v2'}).
start(getItems): vòng lặp requestAnimationFrame gọi model.detect(video) mỗi frame.

BƯỚC 2 — Detection và Drawing:
Tìm prediction có class === 'potted plant' và score cao nhất.
clearRect() mỗi frame. Nếu có plant: vẽ viền xanh nét đứt quanh bbox,
gọi drawItems(ctx, bbox, getItems()).
drawItems(): với mỗi PlacedItem, tính drawX = bbox[0] + bbox[2]*anchorX - drawW/2,
drawY = bbox[1] + bbox[3]*anchorY - drawH/2, drawW = bbox[2]*scaleRatio.
Dùng ctx.drawImage() để vẽ sprite PNG. Cache sprite trong Map<itemId, HTMLImageElement>.

BƯỚC 3 — FilterScreen component (route /camera):
Layout: <video> + <canvas> stack absolute, <div id='filter-hud'> fixed.
HUD top: tên cây + HP bar (đọc từ Zustand, giống Dashboard).
HUD bottom: item carousel + nút 'Quét bệnh AI'.
onTouchEnd/onClick trên canvas: tính anchorX = (tapX - bbox[0]) / bbox[2],
anchorY = (tapY - bbox[1]) / bbox[3]. Tạo PlacedItem, lưu vào store.
Hiện loading spinner khi model đang load ('Đang khởi động camera...').
Hiện hint 'Hướng camera vào chậu cây' khi không detect được plant.

BƯỚC 4 — Cleanup:
stop(): cancelAnimationFrame + stream.getTracks().forEach(t => t.stop()).
Gọi stop() trong useEffect cleanup để tắt camera khi unmount component."
```

---

## 5. GIAI ĐOẠN 3 — CHẨN ĐOÁN AI (Dùng cho Cursor / Gemini)

### 5.1 API Call Function

**File:** `src/ai/diagnose-plant.ts`

```typescript
/**
 * Chụp ảnh từ canvas filter (không phải WebXR canvas nữa), gửi lên Gemini Vision API,
 * nhận kết quả chẩn đoán bệnh lá.
 *
 * @param imageFile - File object từ canvas.toBlob() của FilterEngine canvas
 * @param plantName - Tên cây (để context hóa prompt)
 * @returns DiagnosisResult | null
 */

interface DiagnosisResult {
  disease: string;           // Ví dụ: "Thiếu Nitơ"
  severity: 'mild' | 'moderate' | 'severe';
  treatments: string[];      // Đúng 3 bước, ngắn gọn
  confidence: number;        // 0.0 → 1.0
  isHealthy: boolean;        // true nếu không phát hiện bệnh
}

async function diagnosePlant(
  imageFile: File | Blob,
  plantName: string
): Promise<DiagnosisResult | null> {
  // BƯỚC 1: Convert ảnh sang base64
  const base64Image = await fileToBase64(imageFile);
  const mimeType = imageFile.type || 'image/jpeg'; // 'image/jpeg' | 'image/png'

  // BƯỚC 2: Build prompt — cực kỳ cụ thể để model trả về JSON sạch
  const systemPrompt = `
Bạn là chuyên gia chẩn đoán bệnh thực vật.
Phân tích ảnh lá cây và trả về JSON với cấu trúc sau (KHÔNG có markdown, KHÔNG có backtick):
{
  "disease": "tên bệnh bằng tiếng Việt, hoặc 'Khỏe mạnh' nếu không có bệnh",
  "severity": "mild | moderate | severe",
  "treatments": ["bước 1", "bước 2", "bước 3"],
  "confidence": 0.0-1.0,
  "isHealthy": true | false
}
Tên cây: ${plantName}.
Nếu ảnh không phải lá cây, trả về { "error": "Không phải ảnh lá cây" }.
  `.trim();

  // BƯỚC 3: Gọi Gemini API
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image  // base64 string, KHÔNG có prefix "data:image/..."
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,      // Thấp → ít hallucinate
          maxOutputTokens: 512
        }
      })
    }
  );

  // BƯỚC 4: Parse response
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // BƯỚC 5: Strip markdown fences nếu model vẫn thêm vào
  const cleanJson = rawText.replace(/```json|```/g, '').trim();
  const result: DiagnosisResult = JSON.parse(cleanJson);

  // BƯỚC 6: Trigger reward nếu chẩn đoán thành công
  if (result && !result.isHealthy && result.confidence > 0.6) {
    // Lưu diagnosis vào pending — reward sẽ cộng sau khi user xác nhận chữa khỏi
    savePendingDiagnosis(result);
  } else if (result?.isHealthy) {
    // Cây khỏe → thưởng nhỏ cho việc kiểm tra
    rewardPlayer(10, 'scan_healthy');
  }

  return result;
}
```

### 5.2 Hàm rewardPlayer()

**File:** `src/store/game-store.ts` (xem thêm Giai đoạn 4)

```typescript
/**
 * Cộng phần thưởng cho người dùng và kích hoạt animation celebration.
 * @param amount - Số Green Coins cộng thêm
 * @param reason - Key lý do (để log và tránh double-reward)
 */
function rewardPlayer(amount: number, reason: string): void {
  // 1. Cộng vào store: coins += amount
  // 2. Log vào rewardHistory[] với timestamp
  // 3. Dispatch event 'reward' để UI hiển thị toast "+100 GC 🎉"
  // 4. Lưu vào LocalStorage ngay lập tức
}
```

### 5.3 Capture Frame Từ AR Scene

Khi user nhấn nút "Quét bệnh AI" trong màn hình Camera Filter:

```typescript
async function captureFilterFrame(): Promise<Blob> {
  // Lấy canvas của FilterEngine — đây là canvas thông thường, không phải WebXR canvas
  // Không có security restriction như WebXR canvas, luôn trả về ảnh đúng
  const canvas = document.getElementById('filter-canvas') as HTMLCanvasElement;
  return new Promise((resolve) => {
    // Chụp frame hiện tại bao gồm cả camera feed + items overlay
    // quality: 0.85 — cân bằng giữa chất lượng đủ để AI phân tích và kích thước file
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85);
  });
}
```

> **Lợi thế so với WebXR canvas:** Canvas 2D thông thường không có security restriction như WebXR canvas (vốn thường trả về ảnh trống do cross-origin policy). `captureFilterFrame()` luôn hoạt động đúng trên mọi trình duyệt.

---

## 6. GIAI ĐOẠN 4 — GAMIFICATION (Dùng cho Cursor / Claude)

### 6.1 Data Model (TypeScript Interfaces)

**File:** `src/types/game.types.ts`

```typescript
// ===== PLANT =====
interface Plant {
  id: string;
  name: string;
  species?: string;
  thumbnailBase64: string;      // Ảnh cây lúc thêm vào, lưu base64 nhỏ (max 100KB)
  hp: number;                   // 0–100
  lastWateredAt: number;        // timestamp ms
  lastWipedAt: number;          // "lau lá" action
  createdAt: number;
  placedItems: PlacedItem[];    // Vật phẩm AR đã gắn
  pendingDiagnosis?: DiagnosisResult;
}

// ===== INVENTORY =====
interface InventoryItem {
  itemId: string;               // key trong ITEM_REGISTRY
  purchasedAt: number;
  quantity: number;
}

// ===== SHOP ITEM =====
interface ShopItem {
  id: string;
  name: string;
  category: 'hat' | 'glasses' | 'block' | 'vfx';
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  price: number;                // Green Coins
  spritePath: string;           // PNG sprite với transparent background (thay gltfPath)
  previewImagePath: string;     // PNG isometric preview cho shop
  defaultAnchor: {              // Vị trí mặc định trên bounding box cây
    anchorX: number;            // 0 = trái, 0.5 = giữa, 1 = phải
    anchorY: number;            // 0 = đỉnh, 0.5 = giữa, âm = trên đầu cây
    scaleRatio: number;         // kích thước tương đối so với chiều rộng bbox
  };
  unlockedByDefault: boolean;
  requiredLevel?: number;
}

// ===== PLAYER STATE =====
interface PlayerState {
  coins: number;                // Green Coins
  xp: number;
  level: number;                // floor(xp / 500) + 1
  plants: Plant[];
  inventory: InventoryItem[];
  rewardHistory: RewardLog[];
  lastSyncAt: number;
}

interface RewardLog {
  id: string;
  type: 'water' | 'wipe' | 'cure_disease' | 'scan_healthy' | 'purchase';
  amount: number;
  coinsDelta: number;
  xpDelta: number;
  timestamp: number;
  plantId?: string;
}
```

### 6.2 State Manager với LocalStorage Persistence

**File:** `src/store/game-store.ts`

Dùng **Zustand** với middleware `persist` — đây là pattern chuẩn:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'plantcraft_v1';

// Bảng XP và COINS theo từng action
const REWARD_TABLE = {
  water:         { xp: 10,  coins: 0   },
  wipe:          { xp: 10,  coins: 0   },
  cure_disease:  { xp: 50,  coins: 100 },
  scan_healthy:  { xp: 5,   coins: 10  },
} as const;

interface GameActions {
  // Plant management
  addPlant: (name: string, thumbnailBase64: string) => void;
  waterPlant: (plantId: string) => void;
  wipePlant: (plantId: string) => void;
  curePlant: (plantId: string, diagnosisId: string) => void;
  updateHP: () => void;   // Gọi mỗi khi app mở để tính HP mới

  // Economy
  purchaseItem: (itemId: string) => boolean;   // false nếu không đủ tiền
  rewardPlayer: (amount: number, reason: keyof typeof REWARD_TABLE) => void;

  // AR
  savePlacedItem: (plantId: string, item: PlacedItem) => void;
  removePlacedItem: (plantId: string, itemInstanceId: string) => void;
}

export const useGameStore = create<PlayerState & GameActions>()(
  persist(
    (set, get) => ({
      // --- Initial state ---
      coins: 50,          // 50 coins khởi đầu để mua được item đầu tiên
      xp: 0,
      level: 1,
      plants: [],
      inventory: [],
      rewardHistory: [],
      lastSyncAt: Date.now(),

      // --- Actions ---
      waterPlant: (plantId) => {
        const { xp, coins } = get();
        const rewards = REWARD_TABLE.water;
        set((state) => ({
          plants: state.plants.map(p =>
            p.id === plantId
              ? { ...p, lastWateredAt: Date.now(), hp: Math.min(100, p.hp + 20) }
              : p
          ),
          xp: xp + rewards.xp,
          coins: coins + rewards.coins,
          level: Math.floor((xp + rewards.xp) / 500) + 1,
          rewardHistory: [
            ...get().rewardHistory,
            { id: uuidv4(), type: 'water', amount: rewards.xp,
              coinsDelta: rewards.coins, xpDelta: rewards.xp,
              timestamp: Date.now(), plantId }
          ]
        }));
        // Dispatch toast event
        window.dispatchEvent(new CustomEvent('plantcraft:reward', {
          detail: { xp: rewards.xp, coins: rewards.coins, action: 'Tưới nước' }
        }));
      },

      wipePlant: (plantId) => {
        // Tương tự waterPlant, dùng REWARD_TABLE.wipe
        // HP +10, XP +10
      },

      curePlant: (plantId, diagnosisId) => {
        const rewards = REWARD_TABLE.cure_disease;
        // 1. Xóa pendingDiagnosis khỏi plant
        // 2. Cộng coins + xp
        // 3. Log reward
        // 4. Dispatch 'plantcraft:reward' event với amount 100 coins
      },

      purchaseItem: (itemId) => {
        const { coins, inventory } = get();
        const item = ITEM_REGISTRY[itemId];
        if (!item || coins < item.price) return false;
        set({
          coins: coins - item.price,
          inventory: [
            ...inventory,
            { itemId, purchasedAt: Date.now(), quantity: 1 }
          ]
        });
        return true;
      },

      updateHP: () => {
        const now = Date.now();
        set((state) => ({
          plants: state.plants.map(plant => {
            const hoursSinceWater = (now - plant.lastWateredAt) / 3600000;
            const newHP = Math.max(0, 100 - Math.floor(hoursSinceWater * 4));
            // HP giảm 4 điểm mỗi giờ không tưới (~25 giờ là chết)
            return { ...plant, hp: newHP };
          })
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Chỉ persist các field cần thiết, bỏ qua actions
      partialize: (state) => ({
        coins: state.coins,
        xp: state.xp,
        level: state.level,
        plants: state.plants,
        inventory: state.inventory,
        rewardHistory: state.rewardHistory.slice(-100), // Chỉ giữ 100 log gần nhất
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);
```

### 6.3 Item Registry

**File:** `src/data/item-registry.ts`

```typescript
export const ITEM_REGISTRY: Record<string, ShopItem> = {
  'hat_grass': {
    id: 'hat_grass',
    name: 'Mũ Cỏ Xanh',
    category: 'hat',
    rarity: 'common',
    price: 50,
    gltfPath: '/assets/models/hat_grass.gltf',
    previewImagePath: '/assets/previews/hat_grass.png',
    unlockedByDefault: true,
  },
  'glasses_sunflower': {
    id: 'glasses_sunflower',
    name: 'Kính Hoa Hướng Dương',
    category: 'glasses',
    rarity: 'uncommon',
    price: 120,
    gltfPath: '/assets/models/glasses_sunflower.gltf',
    previewImagePath: '/assets/previews/glasses_sunflower.png',
    unlockedByDefault: true,
  },
  'block_diamond': {
    id: 'block_diamond',
    name: 'Khối Kim Cương',
    category: 'block',
    rarity: 'rare',
    price: 300,
    gltfPath: '/assets/models/block_diamond.gltf',
    previewImagePath: '/assets/previews/block_diamond.png',
    unlockedByDefault: false,
    requiredLevel: 3,
  },
  'vfx_butterflies': {
    id: 'vfx_butterflies',
    name: 'Bướm Pixel Bay',
    category: 'vfx',
    rarity: 'rare',
    price: 250,
    gltfPath: '/assets/models/butterflies.gltf',
    previewImagePath: '/assets/previews/butterflies.png',
    unlockedByDefault: false,
  },
  'hat_crown_legendary': {
    id: 'hat_crown_legendary',
    name: 'Vương Miện Vàng',
    category: 'hat',
    rarity: 'legendary',
    price: 1000,
    gltfPath: '/assets/models/crown_gold.gltf',
    previewImagePath: '/assets/previews/crown_gold.png',
    unlockedByDefault: false,
    requiredLevel: 10,
  },
};
```

### 6.4 Reward Toast Component

**File:** `src/components/RewardToast.tsx`

Lắng nghe event `plantcraft:reward` và hiển thị notification bay lên:

```tsx
// Component này mount ở root App, lắng nghe global event
// Khi nhận event → hiển thị toast animation:
// "+10 XP ⭐ | Tưới nước" xuất hiện ở giữa màn hình, fade up, disappear sau 2s
// Nếu coins > 0: "+100 💰 Green Coins!" toast màu vàng to hơn
```

---

## 5. GIAI ĐOẠN 5 — QR CODE ANCHOR & SHARED AR (Dùng cho Cursor)

### 5.1 Tổng Quan Kỹ Thuật — Tại Sao QR Code Là Mốc Không Gian?

Vấn đề cốt lõi của Shared AR là hai điện thoại khác nhau cần "đồng ý" với nhau về vị trí trong không gian vật lý. Cloud Anchors (ARCore/ARKit) giải quyết bằng cách quét đặc điểm môi trường, nhưng không hỗ trợ trên WebXR. QR code giải quyết vấn đề này theo cách khác: thay vì để máy tự nhận diện môi trường, ta đặt một "mốc nhân tạo" vật lý (tờ giấy QR) ngay tại vị trí cây. Mỗi thiết bị khi nhìn thấy cùng một QR code sẽ biết chính xác cùng một điểm trong không gian — và từ đó có thể render nội dung AR đúng chỗ, đúng hướng, bất kể thiết bị nào đang dùng.

Luồng dữ liệu tổng thể hoạt động như sau:

```
[Owner] Tạo QR → dán lên chậu → bật Public Mode → push lên Firebase
                                                              │
                                                              ▼
[Viewer] Quét QR ──► parse plantId ──► fetch từ Firebase ──► render
                                              │
                              Firebase listener cập nhật realtime
                              khi owner chăm sóc cây (HP thay đổi)
```

### 5.2 Phía Owner — Tạo và Chia Sẻ QR Code

**File:** `src/components/QR/PlantQRScreen.tsx`

Màn hình này được navigate đến từ Plant Card bằng nút "📤 Chia sẻ". Nó thực hiện hai việc độc lập: tạo QR code để in, và bật/tắt Public Mode để sync dữ liệu lên Firebase.

```typescript
import QRCode from 'qrcode';

// Nội dung encode vào QR — đủ để người quét biết cần fetch dữ liệu gì
interface QRPayload {
  app: 'plantcraft';       // guard để phân biệt QR của PlantCraft với QR khác
  plantId: string;
  ownerUid: string;        // Firebase UID của chủ cây — dùng làm path trong DB
  version: 1;              // versioning để backward compatible sau này
}

async function generatePlantQR(plant: Plant, ownerUid: string): Promise<string> {
  const payload: QRPayload = {
    app: 'plantcraft',
    plantId: plant.id,
    ownerUid,
    version: 1,
  };

  // Encode thành JSON string rồi đưa vào QR
  // Trả về data URL của ảnh PNG — có thể dùng trực tiếp trong <img src={...}>
  const dataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
    width: 300,
    margin: 2,
    color: {
      dark: '#2D4A1E',   // màu xanh rừng — giữ vibe Cottagecore thay vì đen thuần
      light: '#F5F0E8',  // màu nền kem của app
    },
    errorCorrectionLevel: 'H', // mức cao nhất — chịu được QR bị bẩn hoặc nhòe 30%
  });

  return dataUrl;
}
```

**Public Mode Toggle — Sync Lên Firebase:**

Khi owner bật toggle "Chia sẻ công khai", app gọi `publishToFirebase()`. Khi tắt, gọi `unpublishFromFirebase()` để xóa dữ liệu. Đây là opt-in có ý thức — mặc định mọi cây đều private, không tự động upload.

```typescript
// firebase/plant-sync.ts
import { ref, set, remove, onValue, off } from 'firebase/database';
import { db } from './firebase-config';

// Schema path: plantcraft-public/{ownerUid}/{plantId}
// Phân cấp theo ownerUid trước để Firebase Security Rules dễ viết

interface SharedPlacedItem {
  id: string;
  itemId: string;       // key trong ITEM_REGISTRY — viewer dùng để load đúng PNG sprite
  // Tọa độ tương đối với bounding box — hoạt động trên mọi thiết bị
  // (thay thế qrRelativePosition 3D phức tạp cũ)
  anchorX:    number;   // 0–1 theo chiều ngang bbox
  anchorY:    number;   // có thể âm (phía trên cây)
  scaleRatio: number;   // kích thước tương đối với chiều rộng bbox
}

interface PublicPlantData {
  name: string;
  hp: number;
  species?: string;
  placedItems: SharedPlacedItem[];
  lastUpdated: number;
}

export async function publishToFirebase(
  plant: Plant,
  ownerUid: string
): Promise<void> {
  const path = `plantcraft-public/${ownerUid}/${plant.id}`;

  // Map PlacedItem (local) → SharedPlacedItem (Firebase) — đơn giản hơn nhiều
  const sharedItems: SharedPlacedItem[] = plant.placedItems
    .filter(item => item.isShared)
    .map(item => ({
      id:         item.id,
      itemId:     item.itemId,
      anchorX:    item.anchorX,
      anchorY:    item.anchorY,
      scaleRatio: item.scaleRatio,
    }));

  const data: PublicPlantData = {
    name:        plant.name,
    hp:          plant.hp,
    species:     plant.species,
    placedItems: sharedItems,
    lastUpdated: Date.now(),
  };
  await set(ref(db, path), data);
}

// Gọi ngay sau khi owner đặt một item mới (isShared = true)
export async function syncPlacedItemToFirebase(
  plantId: string,
  ownerUid: string,
  item: PlacedItem
): Promise<void> {
  if (!item.isShared) return;

  const sharedItem: SharedPlacedItem = {
    id:         item.id,
    itemId:     item.itemId,
    anchorX:    item.anchorX,
    anchorY:    item.anchorY,
    scaleRatio: item.scaleRatio,
  };

  const path = `plantcraft-public/${ownerUid}/${plantId}/placedItems/${item.id}`;
  await set(ref(db, path), sharedItem);
}

// Xóa một item khỏi Firebase khi owner remove nó trong AR
export async function removeSharedItemFromFirebase(
  plantId: string,
  ownerUid: string,
  itemInstanceId: string
): Promise<void> {
  await remove(ref(db, `plantcraft-public/${ownerUid}/${plantId}/placedItems/${itemInstanceId}`));
}

export async function unpublishFromFirebase(
  plantId: string,
  ownerUid: string
): Promise<void> {
  await remove(ref(db, `plantcraft-public/${ownerUid}/${plantId}`));
}

// Gọi hàm này mỗi khi owner tưới nước, lau lá, hay chữa bệnh
// để HP trên Firebase luôn đồng bộ với LocalStorage
export async function syncHPToFirebase(
  plantId: string,
  ownerUid: string,
  newHP: number
): Promise<void> {
  const path = `plantcraft-public/${ownerUid}/${plantId}/hp`;
  await set(ref(db, path), newHP);
  await set(ref(db, `plantcraft-public/${ownerUid}/${plantId}/lastUpdated`), Date.now());
}
```

**Firebase Security Rules** — phải cấu hình trong Firebase Console trước khi deploy:

```json
{
  "rules": {
    "plantcraft-public": {
      "$ownerUid": {
        ".read": true,
        ".write": "auth !== null && auth.uid === $ownerUid"
      }
    }
  }
}
```

Giải thích logic: bất kỳ ai cũng có thể đọc (`.read: true`) vì đây là dữ liệu public theo ý người dùng. Nhưng chỉ người đang đăng nhập với đúng UID đó mới được ghi — ngăn viewer giả mạo HP của cây người khác.

### 5.3 Phía Viewer — Quét QR và Render Filter Lên Cây Bạn

**File:** `src/components/ScanFriend/ScanFriendScreen.tsx`

Màn hình này dùng **cùng FilterEngine** với màn hình Camera cá nhân — thay vì load MindAR.js phức tạp. Sự khác biệt duy nhất: data source không phải từ Zustand store của owner mà từ Firebase realtime. Viewer cũng thấy COCO-SSD detect cây của họ, và items của owner được vẽ đè lên theo anchor tỉ lệ — hoàn toàn giống hệt cách filter TikTok hoạt động.

**Cấu trúc DOM — giống hệt FilterScreen nhưng data đến từ Firebase:**

```tsx
// ScanFriendScreen.tsx
export function ScanFriendScreen() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FilterEngine | null>(null);

  // State của cây bạn (fetch từ Firebase)
  const [friendPlant, setFriendPlant] = useState<PublicPlantData | null>(null);
  const [scanning,    setScanning]    = useState(true);   // true = đang quét QR
  const [error,       setError]       = useState('');

  useEffect(() => {
    const engine = new FilterEngine(videoRef.current!, canvasRef.current!);
    engineRef.current = engine;

    engine.init().then(() => {
      // Bắt đầu quét QR song song với camera
      startQRScanning(videoRef.current!, (data) => {
        setFriendPlant(data);
        setScanning(false);
        // Khi có data → khởi động filter loop với items của bạn
        engine.start(() => data.placedItems.map(toLocalPlacedItem));
      });
    });

    return () => { engine.stop(); stopQRScanning(); };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <video ref={videoRef}
        autoPlay muted playsInline
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <canvas ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* HUD overlay — React thuần, không cần WebXR */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
        {scanning ? (
          <ScanPrompt />          // "Hướng camera vào QR trên chậu cây"
        ) : friendPlant ? (
          <FriendPlantHUD plant={friendPlant} />   // Tên + HP bar của cây bạn
        ) : (
          <ErrorMessage text={error} />
        )}
      </div>
    </div>
  );
}

// Convert SharedPlacedItem (Firebase) → PlacedItem local format cho FilterEngine
function toLocalPlacedItem(item: SharedPlacedItem): PlacedItem {
  return {
    id: item.id, itemId: item.itemId, plantId: '',
    anchorX: item.anchorX, anchorY: item.anchorY,
    scaleRatio: item.scaleRatio,
    isShared: true, placedAt: 0,
  };
}
```

**Script quét QR — jsQR, giống cũ nhưng callback trả về PublicPlantData:**

```typescript
// src/filter/qr-scanner.ts
import jsQR from 'jsqr';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../firebase/firebase-config';

let scanInterval: ReturnType<typeof setInterval> | null = null;
let firebaseUnsubscribe: (() => void) | null = null;

export function startQRScanning(
  video: HTMLVideoElement,
  onData: (data: PublicPlantData) => void
): void {
  const tmpCanvas = document.createElement('canvas');
  const ctx = tmpCanvas.getContext('2d')!;

  scanInterval = setInterval(() => {
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
    tmpCanvas.width  = video.videoWidth;
    tmpCanvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imgData = ctx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);
    const result  = jsQR(imgData.data, tmpCanvas.width, tmpCanvas.height);
    if (!result) return;

    try {
      const payload = JSON.parse(result.data) as QRPayload;
      if (payload.app !== 'plantcraft') return;

      clearInterval(scanInterval!);  // ngừng scan sau khi detect

      // Subscribe Firebase realtime
      const path     = `plantcraft-public/${payload.ownerUid}/${payload.plantId}`;
      const plantRef = ref(db, path);
      const unsub    = onValue(plantRef, (snap) => {
        if (!snap.exists()) return;
        onData(snap.val() as PublicPlantData); // fires ngay + mỗi khi owner thay đổi
      });
      firebaseUnsubscribe = () => off(plantRef, 'value', unsub);

    } catch { /* QR nội dung khác, bỏ qua */ }
  }, 200);
}

export function stopQRScanning(): void {
  if (scanInterval)          clearInterval(scanInterval);
  if (firebaseUnsubscribe)   firebaseUnsubscribe();
  scanInterval = firebaseUnsubscribe = null;
}
```

**Tại sao cách này thanh lịch hơn MindAR rất nhiều:**

FilterEngine đã xử lý toàn bộ việc detect cây và vẽ items — viewer chỉ cần truyền vào một `getItems` function khác nguồn data (Firebase thay vì Zustand). FilterEngine không quan tâm data đến từ đâu, chỉ cần danh sách `PlacedItem[]` với `anchorX/Y/scaleRatio`. Khi Firebase realtime update (owner tưới nước → HP thay đổi, owner thêm item mới), callback `onData` fire → `setFriendPlant()` cập nhật state → React re-render HUD + `engine.start()` nhận `getItems` mới → items mới xuất hiện trong frame tiếp theo.

### 5.4 Firebase Config và Khởi Tạo

**File:** `src/firebase/firebase-config.ts`

```typescript
import { initializeApp } from 'firebase/app';
import { getDatabase }   from 'firebase/database';
import { getAuth }       from 'firebase/auth';

// Các giá trị này lấy từ Firebase Console → Project Settings → Your apps
// Lưu vào .env.local, KHÔNG commit lên GitHub
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db   = getDatabase(app);   // Realtime Database
export const auth = getAuth(app);       // Authentication (dùng cho Security Rules)
```

**File `.env.local` — thêm 7 biến mới bên cạnh Gemini API Key:**

```
VITE_GEMINI_API_KEY=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=plantcraft-xxx.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://plantcraft-xxx-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=plantcraft-xxx
VITE_FIREBASE_STORAGE_BUCKET=plantcraft-xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> **Chọn region `asia-southeast1` (Singapore)** khi tạo Realtime Database để latency thấp nhất cho người dùng Việt Nam.

### 5.5 Tích Hợp Với Gamification Store

Khi owner thực hiện hành động chăm sóc (waterPlant, wipePlant, curePlant), Zustand store cập nhật HP trong LocalStorage. Nếu cây đang ở Public Mode, cần sync đồng thời lên Firebase. Thêm side effect vào game-store.ts:

```typescript
// Bên trong waterPlant action trong game-store.ts — thêm đoạn sync này:
waterPlant: (plantId) => {
  // ... logic cũ: cập nhật HP trong LocalStorage ...

  // Sync lên Firebase nếu cây đang public
  const plant = get().plants.find(p => p.id === plantId);
  if (plant?.isPublic) {
    const ownerUid = auth.currentUser?.uid;
    if (ownerUid) {
      // Fire-and-forget — không await, không block UI
      syncHPToFirebase(plantId, ownerUid, Math.min(100, plant.hp + 20))
        .catch(err => console.warn('Firebase sync failed:', err));
    }
  }
},
```

### 5.6 Prompt Cho Cursor — QR Code Anchor + Shared Filter

```
"Thêm tính năng Shared AR (QR Anchor) vào PlantCraft. Dùng FilterEngine có sẵn,
jsQR và Firebase. KHÔNG dùng MindAR, A-Frame, hay WebXR.

BƯỚC 1 — Firebase setup (nếu chưa có):
Tạo src/firebase/firebase-config.ts: initializeApp, export db (getDatabase), auth (getAuth).
Security Rules: plantcraft-public/{ownerUid}/.read=true, .write='auth.uid===$ownerUid'.

BƯỚC 2 — Owner tạo QR (PlantQRScreen.tsx, route /plant/:plantId/qr):
Dùng 'qrcode' lib tạo QR từ JSON {app:'plantcraft', plantId, ownerUid, version:1}.
Hiển thị QR image to, màu #2D4A1E / nền #F5F0E8. Nút tải PNG.
Toggle 'Chia sẻ công khai': khi bật gọi publishToFirebase() — push name, hp,
và danh sách placedItems có isShared=true (chỉ lưu anchorX, anchorY, scaleRatio, itemId).
Khi tắt gọi unpublishFromFirebase(). Thêm nút '📤 Chia sẻ' vào PlantCard.

BƯỚC 3 — Đặt item có isShared (FilterScreen, sửa handleCanvasTap):
Khi plant.isPublic === true, set isShared=true trong PlacedItem được tạo.
Sau khi savePlacedItem(), gọi syncPlacedItemToFirebase() fire-and-forget.
syncPlacedItemToFirebase() ghi vào path: plantcraft-public/{uid}/{plantId}/placedItems/{id}
với {id, itemId, anchorX, anchorY, scaleRatio}.

BƯỚC 4 — Viewer quét QR (ScanFriendScreen.tsx, route /scan-friend):
Khởi tạo FilterEngine(video, canvas) giống FilterScreen.
Song song: chạy jsQR scan mỗi 200ms trên video frame.
Khi jsQR detect QR PlantCraft → parse ownerUid + plantId →
Firebase onValue(plantcraft-public/{ownerUid}/{plantId}) →
Khi nhận data: setFriendPlant(data), engine.start(() => data.placedItems.map(toLocalPlacedItem)).
HUD top hiển thị tên cây + HP bar của bạn (đọc từ friendPlant state).
Khi Firebase update (owner thêm item / tưới nước): callback fire → engine.start() với items mới.
useEffect cleanup: engine.stop() + stopQRScanning() + Firebase off().

Thêm '🔍 Quét bạn' vào BottomNav dẫn đến /scan-friend.
Giữ nguyên toàn bộ FilterScreen hiện có — Shared AR chỉ là ScanFriendScreen mới."
```

### 5.7 Giới Hạn Kỹ Thuật Cần Biết Trước

**Items không "dính" 100% vào cây khi di chuyển nhanh:** COCO-SSD chạy ~15fps trên mobile nên bbox có thể lag 1–2 frame khi camera di chuyển nhanh. Items sẽ "nhảy" nhẹ. Giải pháp: lerp (linear interpolation) vị trí bbox giữa các frame để chuyển động mượt hơn — thêm `smoothedBbox = lerp(smoothedBbox, newBbox, 0.4)` trước khi gọi `drawItems()`.

**COCO-SSD không detect được nếu cây quá nhỏ hoặc quá gần:** Model cần cây chiếm ít nhất ~15% diện tích frame. Giải pháp: hiện hướng dẫn "Lùi camera ra xa hơn" khi không detect được sau 3 giây.

**jsQR vs camera resolution:** Trên điện thoại giá rẻ, video resolution thấp khiến QR nhỏ khó detect. Hướng dẫn user "Đưa camera cách QR 15–30cm".

**Firebase free tier (Spark):** 100 concurrent connections, 1GB/tháng — đủ cho demo và beta. Scale lên Blaze plan khi cần.

---

## 7. CẤU TRÚC FILE DỰ ÁN

```
plantcraft/
├── public/
│   └── assets/
│       ├── sprites/           # PNG sprites với transparent bg (thay GLTF)
│       │   ├── hat_grass.png
│       │   ├── glasses_sunflower.png
│       │   ├── block_diamond.png
│       │   └── vfx_butterflies.png
│       └── previews/          # PNG isometric previews cho shop UI
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   │   ├── PlantCard.tsx
│   │   │   ├── HPBar.tsx
│   │   │   └── AddPlantModal.tsx
│   │   ├── Shop/
│   │   │   ├── ItemGrid.tsx
│   │   │   ├── ItemCard.tsx
│   │   │   └── ItemDetailSheet.tsx
│   │   ├── Camera/
│   │   │   ├── FilterScreen.tsx     # Camera cá nhân: detect + đặt items + AI scan
│   │   │   ├── FilterPlantHUD.tsx   # Tên cây + HP bar overlay (CSS fixed, không cần WebXR)
│   │   │   └── ItemCarousel.tsx     # Thanh chọn item bên dưới
│   │   ├── ScanFriend/
│   │   │   └── ScanFriendScreen.tsx # Quét QR bạn + filter engine + Firebase realtime
│   │   ├── QR/
│   │   │   └── PlantQRScreen.tsx    # Tạo QR + toggle Public Mode
│   │   ├── RewardToast.tsx
│   │   └── BottomNav.tsx
│   ├── filter/
│   │   ├── filter-engine.ts         # Class FilterEngine: getUserMedia + COCO-SSD + Canvas 2D
│   │   └── qr-scanner.ts            # jsQR scan + Firebase subscribe
│   ├── firebase/
│   │   ├── firebase-config.ts       # initializeApp, export db + auth
│   │   └── plant-sync.ts            # publishToFirebase, syncPlacedItemToFirebase, syncHPToFirebase
│   ├── ai/
│   │   └── diagnose-plant.ts        # Gemini Vision API call
│   ├── store/
│   │   └── game-store.ts            # Zustand + LocalStorage persist
│   ├── data/
│   │   └── item-registry.ts         # ITEM_REGISTRY với spritePath (thay gltfPath)
│   ├── types/
│   │   └── game.types.ts            # PlacedItem (anchorX/Y/scaleRatio), ShopItem, Plant...
│   ├── App.tsx
│   └── main.tsx
├── .env.local                        # VITE_GEMINI_API_KEY + 7 VITE_FIREBASE_* keys
├── vite.config.ts
└── tailwind.config.ts
```

Hãy hình dung như này: QR code là "bệ phóng", và tất cả vật phẩm được đặt cố định trên bệ phóng đó. Khi camera nhìn thấy bệ phóng ở góc nào, các vật phẩm cũng xuất hiện đúng góc đó so với bệ phóng.

**Cấu trúc A-Frame Scene cho ScanFriendScreen (cập nhật):**

```html
<a-scene
  mindar-image="
    filterMinCF: 0.001;
    filterBeta: 0.001;
    missTolerance: 5;
    warmupTolerance: 3
  "
  embedded
  color-space="sRGB"
  renderer="colorManagement: true"
  vr-mode-ui="enabled: false"
>
  <!-- Asset registry: preload TẤT CẢ GLTF models có thể xuất hiện -->
  <!-- Cần load hết vì viewer không biết trước owner đặt item nào -->
  <a-assets>
    <a-asset-item id="hat_grass-model"       src="/assets/models/hat_grass.gltf"></a-asset-item>
    <a-asset-item id="glasses_sunflower-model" src="/assets/models/glasses_sunflower.gltf"></a-asset-item>
    <a-asset-item id="block_diamond-model"   src="/assets/models/block_diamond.gltf"></a-asset-item>
    <a-asset-item id="vfx_butterflies-model" src="/assets/models/butterflies.gltf"></a-asset-item>
    <!-- ... tất cả items trong ITEM_REGISTRY ... -->
  </a-assets>

  <!-- ĐÂY LÀ ENTITY QUAN TRỌNG NHẤT: track QR code trong 3D space -->
  <!-- targetIndex: 0 = QR code đầu tiên trong danh sách targets -->
  <a-entity id="qr-anchor-target" mindar-image-target="targetIndex: 0">

    <!-- Billboard HUD: tên cây + HP bar — luôn hiện khi QR visible -->
    <a-entity id="plant-billboard" position="0 0.15 0">
      <a-plane width="0.5" height="0.22" color="#1A2E0A" opacity="0.75"></a-plane>
      <a-text id="plant-name-text" value="..." color="#E8F5E9"
              width="0.45" align="center" position="0 0.07 0.001" scale="0.55 0.55 0.55"></a-text>
      <a-text id="plant-hp-text"   value="♥ --/100" color="#81C784"
              width="0.45" align="center" position="0 0 0.001"   scale="0.4 0.4 0.4"></a-text>
      <a-plane id="hp-bar-track"  width="0.38" height="0.02" color="#2E4A1E" position="0 -0.06 0.001"></a-plane>
      <a-plane id="hp-bar-fill"   width="0.38" height="0.02" color="#4CAF50" position="0 -0.06 0.002"></a-plane>
      <a-text  id="status-icon"   value="✅" align="center"   position="0 -0.1 0.001" scale="0.45 0.45 0.45"></a-text>
    </a-entity>

    <!-- Container cho các vật phẩm ảo của owner -->
    <!-- Items sẽ được inject động bằng JS khi fetch từ Firebase -->
    <!-- Vì là con của #qr-anchor-target, chúng TỰ ĐỘNG theo QR -->
    <a-entity id="shared-items-container"></a-entity>

  </a-entity>

  <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
</a-scene>
```

**Hàm `renderSharedItems()` — inject GLTF entities từ Firebase data:**

```typescript
// Thêm vào qr-anchor-manager.ts

/**
 * Xóa tất cả shared items cũ và render lại từ dữ liệu Firebase mới nhất.
 * Gọi hàm này mỗi khi Firebase listener nhận được update từ owner.
 *
 * @param items - Mảng SharedPlacedItem từ Firebase snapshot
 */
function renderSharedItems(items: SharedPlacedItem[]): void {
  const container = document.getElementById('shared-items-container');
  if (!container) return;

  // Xóa toàn bộ items cũ trước khi render lại
  // Dùng innerHTML = '' nhanh hơn loop removeChild()
  container.innerHTML = '';

  items.forEach(item => {
    const { qrRelativePosition: pos, qrRelativeRotation: rot, qrRelativeScale: scale } = item;

    // Kiểm tra item có trong ITEM_REGISTRY không
    // (đề phòng owner có item viewer chưa download model)
    if (!ITEM_REGISTRY[item.itemId]) {
      console.warn(`Item ${item.itemId} not found in ITEM_REGISTRY — skipping`);
      return;
    }

    const entity = document.createElement('a-entity');

    // GLTF model — dùng id pattern `${itemId}-model` khớp với <a-assets> ở trên
    entity.setAttribute('gltf-model', `#${item.itemId}-model`);

    // Position tương đối với QR entity — đây là giá trị đã tính từ phía owner
    entity.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);

    // Rotation dạng quaternion → A-Frame dùng euler degrees, cần convert
    // THREE.js Euler từ Quaternion:
    const euler = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w),
      'YXZ'  // thứ tự Euler phổ biến trong game engines
    );
    entity.setAttribute('rotation',
      `${THREE.MathUtils.radToDeg(euler.x)} ${THREE.MathUtils.radToDeg(euler.y)} ${THREE.MathUtils.radToDeg(euler.z)}`
    );

    entity.setAttribute('scale', `${scale.x} ${scale.y} ${scale.z}`);

    // Data attribute để có thể tìm lại entity nếu cần update sau
    entity.dataset.sharedItemId = item.id;

    container.appendChild(entity);
  });
}

// Cập nhật subscribeToPlant() để gọi renderSharedItems() khi nhận data
function subscribeToPlant(ownerUid: string, plantId: string): void {
  const path = `plantcraft-public/${ownerUid}/${plantId}`;
  if (firebaseUnsubscribe) firebaseUnsubscribe();

  const plantRef = ref(db, path);
  const unsubscribe = onValue(plantRef, (snapshot) => {
    if (!snapshot.exists()) { showPrivateMessage(); return; }

    const data = snapshot.val() as PublicPlantData;

    // Cập nhật Billboard HUD (HP + tên) — như cũ
    updateBillboard(data);

    // MỚI: Render toàn bộ vật phẩm ảo của owner
    // Firebase listener fire mỗi khi owner thêm/xóa item → viewer thấy ngay
    if (data.placedItems) {
      // Convert Firebase object sang array (Firebase lưu object với key là item.id)
      const itemsArray = Object.values(data.placedItems) as SharedPlacedItem[];
      renderSharedItems(itemsArray);
    }
  });

  firebaseUnsubscribe = () => off(plantRef, 'value', unsubscribe);
}
```

**Luồng UX cho Owner khi dùng QR Anchor mode để đặt item:**

Đây là bước owner cần thực hiện trước khi đặt vật phẩm để hệ thống tính được tọa độ tương đối với QR. Nếu bỏ qua bước này, `activeQRAnchorEntity` sẽ là `null` và item sẽ được lưu ở chế độ `camera-relative` — không chia sẻ được.

```
Owner mở AR screen → HUD hiện banner "📷 Quét QR của cây để bật Shared Mode" →
Owner hướng camera vào QR dán trên chậu → MindAR detect QR →
setQRAnchorEntity(qrEntity) gọi → Banner đổi thành "✅ Đã khóa vị trí QR" →
Owner chọn item trong carousel → Tap lên cây →
placeSelectedItem() chạy với activeQRAnchorEntity !== null →
worldToLocal() tính qrRelativePosition → PlacedItem lưu với coordinateSpace: 'qr' →
syncPlacedItemToFirebase() push lên Firebase ngay lập tức →
Viewer đang scan QR nhận Firebase update → renderSharedItems() chạy →
Item mới xuất hiện trên màn hình viewer
```

**Vấn đề MindAR target file cho QR động:**

MindAR thông thường yêu cầu compile một file `.mind` từ ảnh tĩnh trước. Nhưng QR của mỗi cây khác nhau nên không thể compile sẵn. Giải pháp là dùng MindAR ở chế độ **generic QR tracking** (dùng jsQR để detect nội dung) kết hợp với một **tấm target ảnh cố định** (ví dụ logo PlantCraft) để MindAR lấy pose, sau đó dùng vị trí tương đối từ QR text content để xác định plantId. Cách triển khai cụ thể:

```typescript
// Khởi tạo MindAR với một ảnh target cố định (logo PlantCraft)
// File này được compile sẵn một lần và không đổi
const mindAR = new MindARThree({
  container: containerEl,
  imageTargetSrc: '/assets/plantcraft-qr-target.mind',
  // File .mind này được tạo từ một QR mẫu bất kỳ —
  // MindAR sẽ track bất kỳ QR code nào có cùng cấu trúc vuông vức
});

// Khi MindAR detect target, ta lấy pose từ đó
// Đồng thời jsQR đọc nội dung để lấy plantId
// Hai nguồn thông tin này bổ sung cho nhau:
// jsQR  → "đây là cây của ai?"
// MindAR → "tờ giấy này đang ở đâu trong không gian 3D?"
```

---

### 5.9 Owner Flow — Bước Quét QR Trong ARScene.tsx

Đây là thay đổi cần thêm vào màn hình AR cá nhân của owner (không phải ScanFriendScreen). Owner cần một nút để kích hoạt chế độ quét QR của chính mình trước khi đặt vật phẩm.

```tsx
// Thêm vào ARPlantHUD — phần dưới cùng của HUD top bar
{!isQRAnchored ? (
  <button
    onClick={startOwnerQRScan}
    style={{
      background: '#5C8A3C',
      color: 'white',
      padding: '6px 12px',
      borderRadius: 4,
      fontSize: 10,
      fontFamily: '"Press Start 2P"',
      marginTop: 8,
      width: '100%',
    }}
  >
    📷 Quét QR để bật Shared Mode
  </button>
) : (
  <div style={{ color: '#81C784', fontSize: 9, marginTop: 8, textAlign: 'center' }}>
    ✅ Shared Mode — vật phẩm sẽ hiển thị cho bạn bè
  </div>
)}
```

Khi `startOwnerQRScan()` được gọi, một overlay nhỏ (50% màn hình) hiện lên với jsQR chạy để quét QR. Sau khi detect QR của chính cây đó (`payload.plantId === activePlantId`), overlay đóng lại, `setQRAnchorEntity()` được gọi với pose của QR từ MindAR, và owner có thể bắt đầu đặt vật phẩm ở chế độ Shared.

**Billboard không "dính" vào cây khi di chuyển:** MindAR track QR code liên tục, nên Billboard Label sẽ đi theo QR trong không gian. Nhưng nếu QR bị che khuất (ví dụ người dùng đưa tay qua), label sẽ biến mất tạm thời. Đây là hành vi đúng — label chỉ hiện khi camera thấy QR. Cần thông báo người dùng về điều này trong onboarding.

**jsQR vs camera resolution:** Trên các điện thoại giá rẻ, video resolution thấp khiến QR nhỏ khó detect. Giải pháp: thêm hướng dẫn "Đưa camera cách QR khoảng 15–30cm để quét tốt nhất."

**Firebase free tier (Spark):** Giới hạn 100 concurrent connections và 1GB storage/tháng — hoàn toàn đủ cho demo và giai đoạn beta. Khi scale lên cần nâng lên Blaze plan.

---

## 7. CẤU TRÚC FILE DỰ ÁN

```
plantcraft/
├── public/
│   ├── assets/
│   │   ├── models/          # .gltf voxel models (hat, glasses, blocks)
│   │   ├── previews/        # .png isometric previews cho shop
│   │   └── reticle.gltf     # vòng tròn hit-test indicator
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   │   ├── PlantCard.tsx
│   │   │   ├── HPBar.tsx
│   │   │   └── AddPlantModal.tsx
│   │   ├── Shop/
│   │   │   ├── ItemGrid.tsx
│   │   │   ├── ItemCard.tsx
│   │   │   └── ItemDetailSheet.tsx
│   │   ├── AR/
│   │   │   ├── ARScene.tsx          # A-Frame scene cá nhân (hit-test + DOM Overlay HUD)
│   │   │   ├── ARPlantHUD.tsx       # HP bar + tên cây float trên AR
│   │   │   ├── ItemCarousel.tsx     # Thanh chọn item bên dưới
│   │   │   └── ScanButton.tsx
│   │   ├── QR/
│   │   │   └── PlantQRScreen.tsx    # Tạo QR + toggle Public Mode (route: /plant/:id/qr)
│   │   ├── ScanFriend/
│   │   │   └── ScanFriendScreen.tsx # Quét QR bạn + Billboard Label (route: /scan-friend)
│   │   ├── RewardToast.tsx
│   │   └── BottomNav.tsx
│   ├── ar/
│   │   ├── hit-test-component.js    # A-Frame custom component
│   │   ├── ar-manager.ts
│   │   └── qr-anchor-manager.ts    # jsQR scan + Firebase listener + updateBillboard()
│   ├── firebase/
│   │   ├── firebase-config.ts       # initializeApp, export db + auth
│   │   └── plant-sync.ts            # publishToFirebase, unpublishFromFirebase, syncHPToFirebase
│   ├── ai/
│   │   └── diagnose-plant.ts
│   ├── store/
│   │   └── game-store.ts            # Zustand store (thêm isPublic vào Plant, side-effect sync)
│   ├── data/
│   │   └── item-registry.ts
│   ├── types/
│   │   └── game.types.ts            # Thêm QRPayload, PublicPlantData interface
│   ├── App.tsx
│   └── main.tsx
├── .env.local                       # VITE_GEMINI_API_KEY + 7 VITE_FIREBASE_* keys
├── vite.config.ts
└── tailwind.config.ts
```

---

## 8. LUỒNG NGƯỜI DÙNG (User Flows)

### Flow 1: Lần đầu sử dụng
```
Mở app → Dashboard trống → Tap "Thêm cây" → Nhập tên → Chụp ảnh → 
Plant card xuất hiện (HP: 100, trạng thái ✅) → Nhận 50 XP khởi đầu
```

### Flow 2: Chăm sóc hàng ngày
```
Mở app → updateHP() chạy tự động → HP đã giảm xuống 60 → 
Tap "Tưới nước" trên card → HP +20, XP +10 → Toast "+10 XP" bay lên
```

### Flow 3: Chẩn đoán và chữa bệnh (Flow quan trọng nhất)
```
Tap "📷 Camera" → Màn hình AR mở → Hướng vào lá vàng → 
Tap "🔍 Quét bệnh AI" → captureARFrame() → diagnosePlant() → 
Loading spinner 2-3s → Modal kết quả: "Thiếu Nitơ — Mức độ: Trung bình"
→ Hiển thị 3 bước điều trị → Lưu pendingDiagnosis vào plant
→ Sau 3 ngày user chụp lại ảnh lá xanh → curePlant() → +100 GC 🎉
```

### Flow 4: Trang trí AR
```
Tap "AR Trang Trí" trên plant card → Màn hình AR mở →
Chọn item trong carousel bên dưới (ví dụ: Mũ Cỏ Xanh) →
Di chuyển điện thoại cho reticle rơi lên cành cây →
Tap màn hình → placeSelectedItem() → Item xuất hiện trong không gian →
savePlacedItem() lưu vào LocalStorage
```

### Flow 5: Mua vật phẩm
```
Tap "🏪 Shop" → Browse items → Tap item "Kính Hoa Hướng Dương (120 GC)" →
Bottom sheet mở → Tap "Mua ngay" → purchaseItem() kiểm tra coins → 
Coins đủ → coins -= 120, item thêm vào inventory → Toast "Mua thành công!"
```

### Flow 6: Chia sẻ cây cho người khác xem qua QR (Owner)
```
Tap Plant Card → Tap "📤 Chia sẻ QR" → Màn hình /plant/:id/qr mở →
QR code hiển thị to giữa màn hình (chứa plantId + URL deeplink) →
Toast "Bật Public Mode để người khác thấy HP thật nhé!" →
Toggle "Public" → publishToFirebase(plant) →
Đưa điện thoại cho bạn hoặc in QR dán lên chậu
```

### Flow 7: Xem cây của bạn bè qua QR (Viewer)
```
Tap "🔍 Quét bạn" trên bottom nav → Màn hình /scan-friend mở →
MindAR.js khởi động, camera bật → Hướng vào QR code trên chậu cây →
MindAR nhận diện QR → parse plantId → fetchPlantFromFirebase(plantId) →
Billboard Label xuất hiện ngay trên QR: "🌿 Cây Sen Đá — ♥ 72/100" →
HP bar 3D render bên dưới tên → Firebase listener theo dõi realtime →
Nếu chủ cây tưới nước lúc này, HP bar của viewer cập nhật ngay lập tức
```

---

## 9. XỬ LÝ LỖI VÀ EDGE CASES

**LocalStorage đầy:** Wrap tất cả `localStorage.setItem` trong try-catch. Nếu `QuotaExceededError` → xóa `rewardHistory` cũ, nén `thumbnailBase64` xuống quality thấp hơn, thông báo user.

**Gemini API timeout:** Timeout sau 15 giây. Hiển thị "AI đang bận, thử lại sau" thay vì crash. Không trừ lần quét.

**WebXR không hỗ trợ:** Xem mục 4.5. Fallback `'limited'` vẫn cho phép user xem camera và tap để overlay item ảo (không có hit-test thực).

**Ảnh chụp quá tối/mờ:** Gemini sẽ trả về `confidence < 0.4` hoặc `{ "error": "..." }`. Hiển thị "Ảnh chưa đủ sáng rõ — hãy thử chụp gần hơn hoặc ra ngoài sáng."

**COCO-SSD không nhận ra cây:** Xảy ra khi cây quá nhỏ (<15% frame), ánh sáng quá tối, hoặc cây không có chậu rõ ràng. Hiện hint động "Lùi camera ra xa hơn" hoặc "Cần sáng hơn" thay vì để màn hình trống.

**TF.js model chưa load xong:** Hiện spinner "Đang khởi động camera..." với progress bar. Không cho user tap canvas trước khi model ready. Model lite_mobilenet_v2 ~3MB — trên 4G load khoảng 2–3 giây.

**Items "nhảy" khi di chuyển camera nhanh:** Do COCO-SSD chạy async ~15fps. Dùng lerp `smoothedBbox = lerp(prev, next, 0.4)` trước khi gọi `drawItems()` để chuyển động mượt.

**HP về 0:** Plant card chuyển sang màu đỏ, badge "💀 Cần cứu ngay!", shake animation. KHÔNG xóa cây.

---

## 10. TIÊU CHÍ HOÀN THÀNH (Definition of Done)

| Feature | Kiểm tra thế nào |
|---|---|
| Dashboard hiển thị HP bar | HP giảm 4 điểm/giờ, hiển thị đúng màu |
| Thêm cây được | Sau khi thêm, card xuất hiện ngay, persist sau F5 |
| Tưới nước +10 XP | Console log + toast, LocalStorage có entry mới |
| Shop load items | 5+ items hiển thị, filter tab hoạt động |
| Mua item trừ coins | coins giảm đúng, item vào inventory, không được mua khi hết tiền |
| AR mở được camera | `getUserMedia` cấp phép, camera feed hiển thị fullscreen |
| COCO-SSD detect cây | Hướng camera vào chậu cây → viền xanh nét đứt xuất hiện ≤ 2 giây |
| Đặt item lên cây | Tap canvas khi có bbox → sprite PNG vẽ đúng vị trí, theo cây khi di chuyển chậm |
| AR HUD hiển thị | Tên cây + HP bar CSS fixed, màu đổi theo ngưỡng HP |
| HUD HP bar realtime | Sau tưới nước → HP bar cập nhật ngay (Zustand reactive, không cần reload) |
| AI scan trả kết quả | JSON đúng format, treatments có đúng 3 bước |
| Cure disease +100 GC | Sau curePlant(), coins +100 trong store và LocalStorage |
| Data persist sau reload | Mở tab mới, tất cả plants + coins còn nguyên |
| AR HUD hiển thị | Tên cây + HP bar luôn visible trong AR, màu đổi theo ngưỡng HP |
| HUD HP bar realtime | Sau khi tưới nước trong app, HP bar trong AR cập nhật ngay (Zustand reactive) |
| Education Mode toggle | Chuyển sang Edu Mode → xuất hiện nhiệm vụ lớp học thay thế free-play |
| QR code tạo được | Vào /plant/:id/qr → QR hiển thị, nút tải PNG hoạt động, scan QR decode đúng plantId |
| Public Mode publish | Bật toggle → Firebase có data, kiểm tra trong Firebase Console |
| jsQR detect QR | Mở /scan-friend, hướng vào QR → parse plantId thành công trong ≤ 2 giây |
| Viewer thấy HUD bạn | Sau khi jsQR detect → tên cây + HP bar của bạn hiển thị ở HUD top |
| Viewer thấy items bạn | COCO-SSD detect cây của viewer → sprites items của owner vẽ đúng vị trí anchor |
| Items realtime | Owner đặt item mới → viewer thấy item xuất hiện mà không cần reload |
| HP sync realtime | Owner tưới nước → HP bar trên màn hình viewer cập nhật ≤ 1 giây |
| Education Mode toggle | Chuyển sang Edu Mode → xuất hiện nhiệm vụ lớp học thay thế free-play |

---

## 11. EDUCATION MODE — Mở Rộng Sang Trường Học

### 11.1 Bối Cảnh và Nhu Cầu

Nhiều trường học tại Việt Nam tổ chức các hoạt động trồng cây theo nhóm: trồng cây ngày môi trường, câu lạc bộ xanh, chậu cây của lớp, hay tiết Sinh học thực hành về quan sát sự phát triển của thực vật. Vấn đề chung là thiếu công cụ số hóa quá trình theo dõi — học sinh ghi chép bằng tay, giáo viên không có cách nào biết cây có được chăm sóc đúng không, và hoạt động thường mất hứng sau tuần đầu tiên vì không có phần thưởng hay cạnh tranh.

PlantCraft giải quyết vấn đề này bằng cách thêm một "Education Mode" kích hoạt được bằng một toggle trong Settings, biến cùng một ứng dụng thành công cụ học tập có cấu trúc.

### 11.2 Các Tính Năng Của Education Mode

**Class Code — Mã Lớp Học:**

Giáo viên tạo một `classCode` 6 ký tự (ví dụ: `XANH01`) và chia sẻ cho cả lớp. Học sinh nhập code này khi bật Education Mode. Dữ liệu của toàn lớp được sync qua một lightweight backend (Firebase Realtime Database — thêm ở giai đoạn sau MVP, không ảnh hưởng đến LocalStorage core).

**Mission Board — Bảng Nhiệm Vụ Lớp:**

Thay thế free-play bằng danh sách nhiệm vụ tuần có deadline, ví dụ: "Tưới cây mỗi ngày trong 7 ngày liên tiếp (+200 XP)", "Chẩn đoán và chữa khỏi 1 bệnh cho cây (+500 XP)", "Chụp ảnh cây vào thứ Hai và thứ Sáu để quan sát sự thay đổi (+50 XP mỗi lần)". Nhiệm vụ này được giáo viên thiết lập từ một trang /teacher-dashboard đơn giản.

**Class Leaderboard — Bảng Xếp Hạng Lớp:**

Hiển thị top XP của từng học sinh trong lớp (ẩn danh nếu học sinh muốn). Cơ chế này khai thác social motivation — người ta chăm cây chăm hơn khi biết bạn bè đang nhìn. Leaderboard reset theo tuần để học sinh cuối bảng không nản lòng.

**Plant Journal — Nhật Ký Sinh Học:**

Mỗi lần học sinh chụp ảnh lá và AI chẩn đoán, kết quả được lưu vào một "Plant Journal" dạng timeline. Học sinh có thể xuất Journal thành PDF để nộp như bài tập thực hành môn Sinh học — đây là điểm kết nối trực tiếp với chương trình học chính thức.

### 11.3 Data Model Bổ Sung Cho Education Mode

```typescript
interface ClassSession {
  classCode: string;           // 6 ký tự, do giáo viên tạo
  className: string;           // "Lớp 10A2 — Trường THPT ABC"
  teacherName: string;
  weeklyMissions: Mission[];
  leaderboard: LeaderboardEntry[];
  createdAt: number;
}

interface Mission {
  id: string;
  title: string;               // "Tưới cây 7 ngày liên tiếp"
  description: string;
  xpReward: number;
  deadline: number;            // timestamp
  type: 'streak_water' | 'cure_disease' | 'photo_journal' | 'scan_ai';
  requiredCount: number;       // số lần cần hoàn thành
}

interface PlantJournalEntry {
  id: string;
  plantId: string;
  photoBase64: string;         // ảnh lá chụp lúc scan
  diagnosisResult: DiagnosisResult;
  studentNote: string;         // học sinh tự ghi chú quan sát
  recordedAt: number;
}

// Thêm vào PlayerState:
interface PlayerState {
  // ... (các fields cũ)
  educationMode: boolean;
  classCode?: string;
  plantJournal: PlantJournalEntry[];
  completedMissions: string[];  // mảng mission id đã hoàn thành
}
```

### 11.4 Prompt Bổ Sung Cho Cursor — Education Mode

```
"Thêm Education Mode vào PlantCraft. Yêu cầu:
1. Trong Settings, thêm toggle 'Chế độ Lớp học' + input nhập classCode.
2. Khi Education Mode = true, màn hình Dashboard hiển thị thêm section
   'Nhiệm vụ tuần này' với danh sách Mission cards có progress bar.
3. Mỗi khi diagnosePlant() trả kết quả, tự động tạo PlantJournalEntry
   và lưu vào store. Thêm trang /journal/{plantId} hiển thị timeline ảnh.
4. Thêm trang /leaderboard hiển thị danh sách học sinh trong cùng classCode,
   sort theo XP, highlight entry của user hiện tại.
Giữ nguyên toàn bộ logic LocalStorage và Zustand store hiện có — Education
Mode chỉ là một layer thêm lên, không phá vỡ Consumer Mode."
```

### 11.5 Lộ Trình Tích Hợp Với Nhà Trường

Về ngắn hạn (giai đoạn MVP + 1 tháng), PlantCraft có thể tiếp cận trực tiếp câu lạc bộ môi trường và giáo viên Sinh học thông qua demo tại trường. Không cần phê duyệt sở giáo dục vì đây là công cụ tự nguyện, không thay thế chương trình chính thức. Về dài hạn, Plant Journal có thể được tích hợp vào hệ thống chấm điểm điện tử của trường nếu có API kết nối — đây là con đường để PlantCraft trở thành EdTech có doanh thu từ trường học (B2B) thay vì chỉ phụ thuộc vào IAP (B2C).

---

*Bản đặc tả này được viết để tối ưu cho Vibe Coding workflow: mỗi section là một prompt độc lập cho Lovable, v0, hoặc Cursor. Đọc từng giai đoạn theo thứ tự 1→5 để build sản phẩm hoàn chỉnh. MVP (Giai đoạn 1–4) có thể hoàn thành trong một buổi hackathon. Education Mode (mục 11) là Phase 2. QR Code Anchor (mục 5) là Phase 3 — cần Firebase setup trước, build song song với Education Mode.*
