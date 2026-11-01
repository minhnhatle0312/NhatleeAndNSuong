const $ = (s) => document.querySelector(s),
  api = "/api";
let relationshipStartDate = new Date("2025-05-08T00:00:00");
window.relationshipStartDate = relationshipStartDate;
let memories = [],
  filter = "all",
  searchTerm = "",
  timelineMode = false,
  categories = [],
  events = [],
  socket;
const esc = (v) =>
  String(v || "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
function page(id) {
  document
    .querySelectorAll(".page")
    .forEach((x) => x.classList.toggle("active", x.id === id));
  document
    .querySelectorAll("[data-page]")
    .forEach((x) => x.classList.toggle("active", x.dataset.page === id));
  history.replaceState(null, "", "#" + id);
  scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-page]").forEach(
  (x) =>
    (x.onclick = (e) => {
      e.preventDefault();
      page(x.dataset.page);
    }),
);
document.querySelectorAll("[data-go]").forEach(
  (x) =>
    (x.onclick = (e) => {
      e.preventDefault();
      page(x.dataset.go);
    }),
);
if (location.hash && $(location.hash)) page(location.hash.slice(1));
const date = (d) =>
  d
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(d))
    : "Không ghi ngày";
function renderMemories() {
  const show = memories.filter((m) => {
    const matchesType = filter === "all" || m.type === filter;
    const searchable = `${m.title || ""} ${m.caption || ""} ${m.date || ""}`.toLocaleLowerCase("vi");
    return matchesType && searchable.includes(searchTerm);
  });
  $("#memoryGrid").innerHTML = show
    .map(
      (m) =>
        `<article class="memory" data-id="${m._id}"><div class="thumb">${m.type === "video" ? `<video src="${m.url}" muted preload="metadata"></video><span class="badge">▶ VIDEO</span>` : `<img src="${m.url}" alt="${esc(m.title)}" loading="lazy">`}</div><div><h3>${esc(m.title || "Một khoảnh khắc xinh")}</h3><p>${date(m.date)}</p></div></article>`,
    )
    .join("");
  $("#emptyMemories").hidden = show.length > 0;
  if (!show.length && memories.length)
    $("#emptyMemories").textContent = "Chưa tìm thấy khoảnh khắc phù hợp. Thử một từ khóa khác nhé.";
  else if (!memories.length)
    $("#emptyMemories").textContent = "Chưa có kỷ niệm nào. Hãy lưu điều đầu tiên của hai bạn nhé ♡";
  document
    .querySelectorAll(".memory")
    .forEach(
      (x) =>
        (x.onclick = () =>
          openMemory(memories.find((m) => m._id === x.dataset.id))),
    );
  $("#memoryCount").textContent = memories.length;
  if (memories[0]) $("#latestMemory").textContent = date(memories[0].date);
  $("#memoryGrid").hidden = timelineMode;
  $("#timelineView").hidden = !timelineMode;
  $("#timelineToggle").setAttribute("aria-pressed", String(timelineMode));
  renderTimeline(show);
  renderOnThisDay();
}
function renderTimeline(visibleMemories = memories) {
  const items = [
    ...visibleMemories.map((memory) => ({ kind: "memory", date: memory.date || memory.createdAt, memory })),
    ...events.map((event) => ({ kind: "event", date: event.EventDate, event })),
  ].filter((item) => item.date).sort((a, b) => new Date(b.date) - new Date(a.date));
  $("#timelineView").innerHTML = items.length ? items.map((item) => {
    if (item.kind === "memory") {
      const m = item.memory;
      return `<article class="timeline-entry"><time>${date(item.date)}</time><div class="timeline-dot"></div><button class="timeline-memory" type="button" data-memory-id="${esc(m._id)}">${m.type === "video" ? "▶ Video kỷ niệm" : `<img src="${esc(m.url)}" alt="${esc(m.title || "Kỷ niệm của hai bạn")}" loading="lazy">`}<strong>${esc(m.title || "Một khoảnh khắc xinh")}</strong><span>${esc(m.caption || "")}</span></button></article>`;
    }
    const e = item.event;
    const category = categories.find((c) => c.CategoryId === e.CategoryId);
    return `<article class="timeline-entry"><time>${date(item.date)}</time><div class="timeline-dot"></div><div class="timeline-event"><span>${esc(category?.Icon || "♡")}</span><strong>${esc(e.Title)}</strong><small>${e.IsRecurring ? "Kỷ niệm lặp lại hằng năm" : "Một dấu mốc của hai bạn"}</small></div></article>`;
  }).join("") : '<p class="empty">Hành trình của hai bạn sẽ hiện ở đây khi có kỷ niệm hoặc sự kiện.</p>';
}
function renderOnThisDay() {
  const now = new Date();
  const sameDay = memories.filter((m) => {
    const value = String(m.date || m.createdAt || "").slice(0, 10).split("-");
    return value.length === 3 && Number(value[1]) === now.getMonth() + 1 && Number(value[2]) === now.getDate() && Number(value[0]) < now.getFullYear();
  });
  const section = $("#onThisDay");
  section.hidden = sameDay.length === 0;
  if (!sameDay.length) return;
  $("#onThisDayCaption").textContent = `Hôm nay là dịp để nhớ lại ${sameDay.length} khoảnh khắc từ những năm trước.`;
  $("#onThisDayMemories").innerHTML = sameDay.slice(0, 3).map((m) => `<button type="button" class="time-hop" data-memory-id="${esc(m._id)}">${m.type === "image" ? `<img src="${esc(m.url)}" alt="${esc(m.title || "Kỷ niệm cũ")}" loading="lazy">` : "▶"}<span>${esc(m.title || "Một ngày thật đẹp")}</span><small>${date(m.date)}</small></button>`).join("");
  section.querySelectorAll("[data-memory-id]").forEach((button) => button.onclick = () => openMemory(memories.find((m) => m._id === button.dataset.memoryId)));
}
$("#timelineToggle").addEventListener("click", () => { timelineMode = !timelineMode; renderMemories(); });
$("#timelineView").addEventListener("click", (event) => {
  const button = event.target.closest("[data-memory-id]");
  if (button) openMemory(memories.find((m) => m._id === button.dataset.memoryId));
});
function openMemory(m) {
  if (!m) return;
  $("#mediaModal div").innerHTML =
    m.type === "video"
      ? `<video src="${m.url}" controls autoplay></video>`
      : `<img src="${m.url}" alt="${esc(m.title)}">`;
  $("#mediaModal p").textContent = [m.title, m.caption]
    .filter(Boolean)
    .join(" — ");
  $("#mediaModal").hidden = false;
}
$("#mediaModal>button").onclick = () => {
  $("#mediaModal").hidden = true;
  $("#mediaModal div").innerHTML = "";
};
$("#mediaModal").onclick = (e) => {
  if (e.target === $("#mediaModal")) $("#mediaModal>button").click();
};
document.querySelectorAll("[data-filter]").forEach(
  (x) =>
    (x.onclick = () => {
      filter = x.dataset.filter;
      document
        .querySelectorAll("[data-filter]")
        .forEach((b) => b.classList.toggle("active", b === x));
      renderMemories();
    }),
);
$("#memorySearch").addEventListener("input", (event) => {
  searchTerm = event.currentTarget.value.trim().toLocaleLowerCase("vi");
  renderMemories();
});
let wishes = [];
function renderWishes() {
  const list = $("#wishList");
  list.innerHTML = wishes.map((wish) => `<li class="wish-item ${wish.completed ? "completed" : ""}" data-wish-id="${esc(wish.id)}"><button class="wish-toggle" type="button" aria-pressed="${wish.completed}" aria-label="${wish.completed ? "Đánh dấu chưa hoàn thành" : "Đánh dấu đã hoàn thành"}">${wish.completed ? "✓" : "♡"}</button><span>${esc(wish.text)}</span><button class="wish-delete" type="button" aria-label="Xóa điều ước">×</button></li>`).join("");
  const completed = wishes.filter((wish) => wish.completed).length;
  $("#wishProgress").textContent = `${completed}/${wishes.length} điều ước đã hoàn thành`;
  if (!wishes.length) list.innerHTML = '<li class="wish-empty">Danh sách của hai bạn đang chờ điều ước đầu tiên ♡</li>';
}
async function loadWishes() {
  try {
    const response = await fetch(`${api}/wishes`);
    if (!response.ok) throw new Error("Không tải được danh sách.");
    wishes = await response.json();
    renderWishes();
  } catch {
    $("#wishStatus").textContent = "Chưa kết nối được database. Hãy kiểm tra máy chủ rồi thử tải lại.";
  }
}
$("#wishForm").onsubmit = async (event) => {
  event.preventDefault();
  const input = $("#wishInput"), submit = event.currentTarget.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const response = await fetch(`${api}/wishes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input.value.trim() }) });
    if (!response.ok) throw new Error("Không lưu được điều ước.");
    wishes.unshift(await response.json());
    event.currentTarget.reset();
    $("#wishStatus").textContent = "Đã cất một dự định thật đẹp cho hai bạn ♡";
    renderWishes();
  } catch {
    $("#wishStatus").textContent = "Chưa lưu được. Hãy kiểm tra kết nối database rồi thử lại.";
  } finally { submit.disabled = false; }
};
$("#wishList").addEventListener("click", async (event) => {
  const item = event.target.closest("[data-wish-id]");
  if (!item) return;
  const index = wishes.findIndex((wish) => wish.id === item.dataset.wishId);
  if (index < 0) return;
  if (event.target.closest(".wish-toggle")) {
    const wish = wishes[index];
    try {
      const response = await fetch(`${api}/wishes/${encodeURIComponent(wish.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: !wish.completed }) });
      if (!response.ok) throw new Error();
      wishes[index] = await response.json();
      renderWishes();
    } catch { $("#wishStatus").textContent = "Chưa cập nhật được. Hãy thử lại khi máy chủ kết nối."; }
  }
  if (event.target.closest(".wish-delete") && confirm("Xóa điều ước này khỏi danh sách chung?")) {
    try {
      const response = await fetch(`${api}/wishes/${encodeURIComponent(wishes[index].id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      wishes.splice(index, 1);
      renderWishes();
    } catch { $("#wishStatus").textContent = "Chưa xóa được điều ước. Hãy thử lại."; }
  }
});
loadWishes();
async function loadMemories() {
  try {
    let r = await fetch(api + "/memories");
    if (!r.ok) throw 0;
    memories = await r.json();
  } catch {}
  renderMemories();
}
loadMemories();
const input = $("#mediaInput"),
  zone = $("#dropZone");
function preview(f) {
  if (!f) return;
  let u = URL.createObjectURL(f);
  $("#previewWrap").hidden = false;
  $("#previewWrap").innerHTML = f.type.startsWith("video/")
    ? `<video src="${u}" controls></video>`
    : `<img src="${u}" alt="Xem trước">`;
}
input.onchange = () => preview(input.files[0]);
["dragenter", "dragover"].forEach((n) =>
  zone.addEventListener(n, (e) => {
    e.preventDefault();
    zone.classList.add("drag");
  }),
);
["dragleave", "drop"].forEach((n) =>
  zone.addEventListener(n, (e) => {
    e.preventDefault();
    zone.classList.remove("drag");
  }),
);
zone.addEventListener("drop", (e) => {
  input.files = e.dataTransfer.files;
  preview(input.files[0]);
});
$("#uploadForm").onsubmit = async (e) => {
  e.preventDefault();
  let m = $("#uploadMessage");
  m.textContent = "Đang lưu khoảnh khắc...";
  try {
    let r = await fetch(api + "/memories", {
      method: "POST",
      body: new FormData(e.currentTarget),
    });
    if (!r.ok) throw 0;
    memories.unshift(await r.json());
    renderMemories();
    e.currentTarget.reset();
    $("#previewWrap").hidden = true;
    m.textContent = "Đã cất vào hộp kỷ niệm ♡";
  } catch {
    m.textContent = "Chưa thể lưu. Hãy kiểm tra kết nối máy chủ và SQL Server.";
  }
};
function message(m) {
  let mine = m.sender === $("#senderInput").value.trim(),
    time = new Date(m.createdAt || Date.now()).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  $("#messages").insertAdjacentHTML(
    "beforeend",
    `<div class="message ${mine ? "mine" : ""}"><b>${esc(m.sender || "Người thương")}</b><p>${esc(m.text)}</p><time>${time}</time></div>`,
  );
  $("#messages").scrollTop = $("#messages").scrollHeight;
  $("#messageCount").textContent = $("#messages").children.length;
}
async function chat() {
  try {
    let r = await fetch(api + "/messages");
    if (r.ok) (await r.json()).forEach(message);
  } catch {}
  if (window.io) {
    socket = io();
    socket.on(
      "connect",
      () =>
        ($("#connectionStatus").textContent = "Đang ở trong không gian chung"),
    );
    socket.on(
      "disconnect",
      () => ($("#connectionStatus").textContent = "Đang kết nối lại..."),
    );
    socket.on("chat:message", message);
  } else
    $("#connectionStatus").textContent =
      "Chế độ xem trước — hãy chạy server để chat trực tiếp";
}
chat();
$("#chatForm").onsubmit = async (e) => {
  e.preventDefault();
  let sender = $("#senderInput").value.trim() || "Người thương",
    text = $("#messageInput").value.trim();
  if (!text) return;
  let m = { sender, text, createdAt: new Date().toISOString() };
  $("#messageInput").value = "";
  if (socket?.connected) socket.emit("chat:message", m);
  else {
    message(m);
    try {
      await fetch(api + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(m),
      });
    } catch {}
  }
};
setInterval(() => {
  let d = Math.max(0, Date.now() - relationshipStartDate),
    day = Math.floor(d / 864e5);
  d %= 864e5;
  $("#timer").textContent =
    `Bên nhau ${day} ngày ${Math.floor(d / 36e5)} giờ ${Math.floor((d % 36e5) / 6e4)} phút`;
}, 1000);
$("#relationshipSettingsBtn").onclick = async () => {
  $("#relationshipStartInput").value = relationshipStartDate.toISOString().slice(0, 10);
  $("#relationshipStatus").textContent = "";
  $("#relationshipModal").showModal();
};
$("#relationshipCancel").onclick = () => $("#relationshipModal").close();
async function loadRelationshipSettings() {
  try {
    const response = await fetch(`${api}/settings`);
    if (!response.ok) return;
    const settings = await response.json();
    relationshipStartDate = new Date(`${settings.relationshipStart}T00:00:00`);
    window.relationshipStartDate = relationshipStartDate;
    window.dispatchEvent(new Event("relationship-date-updated"));
  } catch { /* Keep the default counter until the database is reachable. */ }
}
$("#relationshipForm").onsubmit = async (event) => {
  event.preventDefault();
  try {
    const response = await fetch(`${api}/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relationshipStart: $("#relationshipStartInput").value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không lưu được ngày.");
    relationshipStartDate = new Date(`${result.relationshipStart}T00:00:00`);
    window.relationshipStartDate = relationshipStartDate;
    window.dispatchEvent(new Event("relationship-date-updated"));
    $("#relationshipStatus").textContent = "Đã cập nhật bộ đếm chung ♡";
    setTimeout(() => $("#relationshipModal").close(), 450);
  } catch (error) { $("#relationshipStatus").textContent = error.message; }
};
loadRelationshipSettings();
$("#musicBtn").onclick = () => {
  let a = $("#bgMusic");
  a.paused ? a.play() : a.pause();
  $("#musicBtn").textContent = a.paused ? "♪" : "Ⅱ";
};
$("#themeBtn").onclick = () => document.body.classList.toggle("night");

// Events Logic
async function loadCategories() {
  try {
    let r = await fetch(api + "/categories");
    if (!r.ok) throw 0;
    categories = await r.json();
    let sel = $("#categorySelect");
    if (sel) {
      sel.innerHTML = '<option value="">Chọn loại...</option>' + categories.map(c => `<option value="${c.CategoryId}">${c.Icon} ${c.CategoryName}</option>`).join('');
    }
  } catch {}
}

async function loadEvents() {
  try {
    let r = await fetch(api + "/events");
    if (!r.ok) throw 0;
    events = await r.json();
  } catch {}
  renderEvents();
  renderTimeline();
}

function renderEvents() {
  let grid = $("#eventsGrid");
  if (!grid) return;
  grid.innerHTML = events.map(e => {
    let cat = categories.find(c => c.CategoryId === e.CategoryId) || { Icon: '📌', Color: '#8c8c8c' };
    let daysDiff = Math.ceil((new Date(e.EventDate) - new Date()) / 864e5);
    let countdownText = daysDiff > 0 ? `Còn ${daysDiff} ngày` : (daysDiff === 0 ? "Hôm nay!" : `Đã qua ${-daysDiff} ngày`);
    return `
      <article class="memory event-card" style="border-left: 4px solid ${cat.Color}; padding: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h3>${cat.Icon} ${esc(e.Title)}</h3>
            <p>${date(e.EventDate)} ${e.IsRecurring ? '🔁' : ''}</p>
          </div>
          <span style="font-weight: 600; color: ${cat.Color}">${countdownText}</span>
        </div>
        ${e.Notes ? `<small style="display: block; margin-top: 0.5rem; opacity: 0.8">${esc(e.Notes)}</small>` : ''}
      </article>
    `;
  }).join("");
  $("#emptyEvents").hidden = events.length > 0;
}

$("#btnAddEvent").onclick = () => $("#eventModal").showModal();
$("#btnCancelEvent").onclick = () => $("#eventModal").close();

$("#eventForm").onsubmit = async (e) => {
  e.preventDefault();
  let fd = new FormData(e.currentTarget);
  let data = Object.fromEntries(fd.entries());
  data.isRecurring = !!fd.get('isRecurring');
  
  try {
    let r = await fetch(api + "/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw 0;
    events.push(await r.json());
    // Sort events
    events.sort((a, b) => new Date(a.EventDate) - new Date(b.EventDate));
    renderEvents();
    $("#eventModal").close();
    e.currentTarget.reset();
  } catch {
    alert('Có lỗi xảy ra khi lưu sự kiện.');
  }
};

loadCategories().then(loadEvents);

const dateIdeas = [
  { title: "Một buổi picnic hoàng hôn", idea: "Chuẩn bị món ăn yêu thích, mang theo tấm chăn nhỏ và ngắm hoàng hôn cùng nhau." },
  { title: "Hẹn hò khám phá quán cà phê mới", idea: "Chọn một quán thật xinh, gọi món chưa từng thử và chụp một tấm ảnh kỷ niệm." },
  { title: "Tối xem phim tại nhà", idea: "Chọn một bộ phim, làm bắp rang và cất điện thoại để dành trọn buổi tối cho nhau." },
  { title: "Cùng nấu một món mới", idea: "Chọn công thức hai bạn chưa từng làm, bật chút nhạc và biến căn bếp thành buổi hẹn." },
  { title: "Đi dạo và chụp ảnh film", idea: "Cùng đi bộ ở một nơi quen thuộc, tìm góc ảnh đẹp và lưu lại một khoảnh khắc bất chợt." },
  { title: "Thử một món ăn đường phố", idea: "Mỗi người chọn một món muốn thử, rồi cùng đi tìm quán ngon trong khu phố." },
];
let selectedDateIdea = null;
$("#surpriseDate").onclick = () => {
  selectedDateIdea = dateIdeas[Math.floor(Math.random() * dateIdeas.length)];
  $("#dateIdea").textContent = selectedDateIdea.idea;
};
$("#planDate").onclick = () => {
  if (!selectedDateIdea) selectedDateIdea = dateIdeas[0];
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  $("#eventForm").elements.namedItem("title").value = selectedDateIdea.title;
  $("#eventForm").elements.namedItem("eventDate").value = localDate;
  $("#eventModal").showModal();
};

const entryTypes = {
  journal: "Nhật ký chung", gift: "Món quà & điều muốn tặng", challenge: "Thử thách yêu thương",
  expense: "Chi phí hẹn hò", mood: "Tâm trạng hôm nay", capsule: "Thư gửi tương lai", place: "Địa điểm muốn ghé",
};
let sharedEntries = [];
function updateEntryForm() {
  const type = $("#entryType").value;
  $("#entryListTitle").textContent = entryTypes[type];
  $("#entryMoodLabel").hidden = type !== "mood";
  $("#entryMood").hidden = type !== "mood";
  $("#entryAmountLabel").hidden = !["expense", "gift"].includes(type);
  $("#entryAmount").hidden = !["expense", "gift"].includes(type);
  $("#entryDateLabel").hidden = type !== "capsule";
  $("#entryDate").hidden = type !== "capsule";
  $("#entryDate").required = type === "capsule";
  $("#entryTitle").placeholder = type === "capsule" ? "Lời nhắn gửi mình của tương lai…" : type === "challenge" ? "Ví dụ: Nói một lời cảm ơn hôm nay" : type === "place" ? "Tên địa điểm hai bạn muốn ghé" : "Một điều mình muốn nhớ…";
  $("#entryBody").placeholder = type === "capsule" ? "Lá thư sẽ được giữ kín đến ngày mở…" : "Kể thêm một chút nhé…";
  loadEntries();
}
function renderEntries() {
  const type = $("#entryType").value;
  const totalExpense = sharedEntries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  $("#entrySummary").textContent = type === "expense" ? `Tổng đã ghi: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(totalExpense)}` : `${sharedEntries.length} mục`;
  $("#entryList").innerHTML = sharedEntries.length ? sharedEntries.map((entry) => {
    const locked = entry.locked ? `<span class="entry-lock">🔒 Mở ngày ${date(entry.targetDate)}</span>` : `<p>${esc(entry.body || "")}</p>`;
    const mood = entry.mood ? `<span class="entry-mood">${esc(entry.mood)}</span>` : "";
    const amount = entry.amount != null ? `<strong class="entry-amount">${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(entry.amount)}</strong>` : "";
    const complete = entry.type === "challenge" ? `<button class="entry-complete" type="button" data-entry-action="complete" aria-pressed="${entry.completed}">${entry.completed ? "Đã hoàn thành ✓" : "Đánh dấu hoàn thành"}</button>` : "";
    return `<article class="vault-entry ${entry.completed ? "is-complete" : ""}" data-entry-id="${esc(entry.id)}"><div class="vault-entry-top"><small>${entry.locked ? "THƯ ĐÃ NIÊM PHONG" : date(entry.createdAt)}</small><button type="button" data-entry-action="delete" aria-label="Xóa mục">×</button></div><h3>${esc(entry.title)}</h3>${mood}${amount}${locked}${complete}</article>`;
  }).join("") : `<p class="vault-empty">${type === "capsule" ? "Một lá thư dành cho tương lai đang chờ hai bạn viết." : "Chưa có mục nào ở đây. Lưu điều đầu tiên nhé ♡"}</p>`;
}
async function loadEntries() {
  try {
    const response = await fetch(`${api}/entries?type=${encodeURIComponent($("#entryType").value)}`);
    if (!response.ok) throw new Error();
    sharedEntries = await response.json();
    renderEntries();
  } catch { $("#entryStatus").textContent = "Chưa kết nối được kho dữ liệu chung."; }
}
$("#entryType").addEventListener("change", updateEntryForm);
$("#entryForm").onsubmit = async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget), type = $("#entryType").value;
  const payload = { type, title: form.get("title"), body: form.get("body"), mood: type === "mood" ? form.get("mood") : "", amount: ["expense", "gift"].includes(type) ? form.get("amount") : null, targetDate: type === "capsule" ? form.get("targetDate") : null };
  try {
    const response = await fetch(`${api}/entries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không lưu được.");
    sharedEntries.unshift(result);
    event.currentTarget.reset();
    $("#entryStatus").textContent = type === "capsule" ? "Đã niêm phong lá thư đến ngày hẹn ♡" : "Đã lưu vào kho báu của hai bạn ♡";
    renderEntries();
  } catch (error) { $("#entryStatus").textContent = error.message || "Chưa lưu được. Hãy kiểm tra kết nối."; }
};
$("#entryList").addEventListener("click", async (event) => {
  const action = event.target.closest("[data-entry-action]")?.dataset.entryAction;
  const item = event.target.closest("[data-entry-id]");
  if (!action || !item) return;
  const index = sharedEntries.findIndex((entry) => entry.id === item.dataset.entryId);
  if (index < 0) return;
  try {
    if (action === "complete") {
      const response = await fetch(`${api}/entries/${encodeURIComponent(sharedEntries[index].id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: !sharedEntries[index].completed }) });
      if (!response.ok) throw new Error();
      sharedEntries[index] = await response.json();
    } else if (confirm("Xóa mục này khỏi kho báu chung?")) {
      const response = await fetch(`${api}/entries/${encodeURIComponent(sharedEntries[index].id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      sharedEntries.splice(index, 1);
    } else return;
    renderEntries();
  } catch { $("#entryStatus").textContent = "Không thể cập nhật mục này. Hãy thử lại."; }
});
updateEntryForm();
$("#exportData").addEventListener("click", async () => {
  const button = $("#exportData");
  button.disabled = true;
  $("#exportStatus").textContent = "Đang chuẩn bị bản sao…";
  try {
    const paths = ["memories", "messages", "events", "categories", "locations", "wishes", ...Object.keys(entryTypes).map((type) => `entries?type=${type}`)];
    const responses = await Promise.all(paths.map((path) => fetch(`${api}/${path}`)));
    if (responses.some((response) => !response.ok)) throw new Error();
    const data = Object.fromEntries(await Promise.all(paths.map(async (path, index) => [path.replaceAll("?type=", "-"), await responses[index].json()])));
    const content = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), format: "memory-space-backup-v1", data }, null, 2)], { type: "application/json" });
    const link = document.createElement("a"), url = URL.createObjectURL(content);
    link.href = url; link.download = `nhatlee-nsuong-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("#exportStatus").textContent = "Đã tải bản sao JSON về thiết bị.";
  } catch { $("#exportStatus").textContent = "Chưa tạo được bản sao. Hãy kiểm tra kết nối rồi thử lại."; }
  finally { button.disabled = false; }
});

