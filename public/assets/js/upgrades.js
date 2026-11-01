(() => {
  const $ = (selector) => document.querySelector(selector),
    start = () => window.relationshipStartDate || new Date("2025-05-08T00:00:00");
  const heart = $("#heartDays"),
    modal = $("#mediaModal"),
    favorites = new Set(
      JSON.parse(localStorage.getItem("memory-favorites") || "[]"),
    );
  let activeCard = null;
  function updateHeart() {
    const days = Math.max(0, Math.floor((Date.now() - start()) / 86400000));
    const currentHeart = $("#heartDays");
    if (currentHeart) currentHeart.textContent = days;
  }
  updateHeart();
  setInterval(updateHeart, 60000);
  window.addEventListener("relationship-date-updated", updateHeart);
  // 3D heart is rendered independently so it remains visible on every browser.
  const core = $(".love-core");
  if (core)
    core.innerHTML =
      '<div class="crystal-heart"><span>♥</span><i>♥</i></div><div class="heart-copy"><span>đã bên nhau</span><strong id="heartDays">0</strong><small>ngày yêu thương</small></div>';
  const crystal = core?.querySelector(".crystal-heart");
  if (crystal) {
    ["b", "em"].forEach((tag) => {
      const layer = document.createElement(tag);
      layer.textContent = "♥";
      crystal.append(layer);
    });
    const stage = document.createElement("div");
    stage.className = "heart-stage";
    crystal.before(stage);
    stage.append(crystal);
    core.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const rect = core.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      stage.style.transform = `rotateX(${(-y * 25).toFixed(1)}deg) rotateY(${(x * 32).toFixed(1)}deg)`;
    });
    core.addEventListener("pointerleave", () => { stage.style.transform = "rotateX(0) rotateY(0)"; });
  }
  const freshHeart = $("#heartDays");
  if (freshHeart)
    freshHeart.textContent = Math.max(
      0,
      Math.floor((Date.now() - start()) / 86400000),
    );
  const cards = () => [...document.querySelectorAll(".memory")],
    store = () =>
      localStorage.setItem("memory-favorites", JSON.stringify([...favorites]));
  const mark = () =>
    cards().forEach((card) =>
      card.classList.toggle("is-favorite", favorites.has(card.dataset.id)),
    );
  const open = (card) => card && card.click();
  document.addEventListener(
    "click",
    (e) => {
      const card = e.target.closest(".memory");
      if (card) activeCard = card;
    },
    true,
  );
  $("#surpriseBtn")?.addEventListener("click", () => {
    const all = cards();
    if (!all.length) {
      $('[data-page="upload"]')?.click();
      return;
    }
    open(all[Math.floor(Math.random() * all.length)]);
  });
  const actions = document.createElement("div");
  actions.className = "modal-actions";
  actions.innerHTML =
    '<button type="button" data-action="previous">←</button><button type="button" data-action="favorite">♡</button><a data-action="download" download>⇩</a><button type="button" data-action="next">→</button>';
  modal.append(actions);
  function refreshActions() {
    if (!activeCard) return;
    actions.querySelector('[data-action="favorite"]').textContent =
      favorites.has(activeCard.dataset.id) ? "♥" : "♡";
    actions.querySelector('[data-action="download"]').href =
      modal.querySelector("img,video")?.src || "";
  }
  actions.onclick = (e) => {
    const action = e.target.dataset.action;
    if (!action || !activeCard) return;
    const all = cards(),
      i = all.indexOf(activeCard);
    if (action === "favorite") {
      favorites.has(activeCard.dataset.id)
        ? favorites.delete(activeCard.dataset.id)
        : favorites.add(activeCard.dataset.id);
      store();
      mark();
      refreshActions();
    }
    if (action === "previous") open(all[(i - 1 + all.length) % all.length]);
    if (action === "next") open(all[(i + 1) % all.length]);
  };
  new MutationObserver(() => {
    mark();
    if (!modal.hidden) refreshActions();
  }).observe(modal, { attributes: true, childList: true, subtree: true });
  document.addEventListener("keydown", (e) => {
    if (modal.hidden) return;
    if (e.key === "Escape") modal.querySelector(":scope > button")?.click();
    if (e.key === "ArrowLeft")
      actions.querySelector('[data-action="previous"]').click();
    if (e.key === "ArrowRight")
      actions.querySelector('[data-action="next"]').click();
  });
  // Consent-based location sharing: only sent after a deliberate user action.
  const panel = document.createElement("section");
  panel.className = "companion-panel";
  panel.innerHTML =
    '<div class="daily-card"><p class="eyebrow">TODAY, TOGETHER</p><strong id="dailyPrompt"></strong><button id="newPrompt" type="button">Đổi lời nhắn ↻</button><div class="moods" aria-label="Tâm trạng hôm nay"><button data-mood="🥰">🥰</button><button data-mood="😊">😊</button><button data-mood="😌">😌</button><button data-mood="🤗">🤗</button></div><small id="moodStatus">Chọn tâm trạng để lưu trên thiết bị này.</small></div><div class="location-card"><div><p class="eyebrow">OUR LITTLE MAP</p><strong>Vị trí của hai mình</strong><small id="locationStatus">Chỉ chia sẻ khi bạn bấm cập nhật.</small></div><button id="shareLocation" type="button">⌖ Cập nhật vị trí của tôi</button><div id="locationList" class="location-list"></div></div>';
  $(".stats")?.after(panel);
  const prompts = [
    "Hôm nay, điều gì làm em mỉm cười?",
    "Nếu được quay lại một ngày, bạn sẽ chọn ngày nào?",
    "Nhắn một câu dịu dàng cho người thương nhé.",
    "Cuối tuần này mình cùng làm gì?",
  ];
  const prompt = $("#dailyPrompt");
  function showPrompt() {
    prompt.textContent = prompts[Math.floor(Math.random() * prompts.length)];
  }
  showPrompt();
  $("#newPrompt").onclick = showPrompt;
  document.querySelectorAll("[data-mood]").forEach(
    (button) =>
      (button.onclick = () => {
        localStorage.setItem("today-mood", button.dataset.mood);
        $("#moodStatus").textContent =
          `Đã lưu tâm trạng ${button.dataset.mood} cho hôm nay ♡`;
      }),
  );
  const savedMood = localStorage.getItem("today-mood");
  if (savedMood)
    $("#moodStatus").textContent = `Tâm trạng đã lưu: ${savedMood} ♡`;
  function renderLocations(items) {
    const list = $("#locationList");
    list.innerHTML = items.length
      ? items
          .map(
            (x) =>
              `<a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${x.latitude}&mlon=${x.longitude}#map=16/${x.latitude}/${x.longitude}"><b>⌖ ${x.userName}</b><span>${new Date(x.updatedAt).toLocaleString("vi-VN")} · ±${x.accuracy || "?"}m</span></a>`,
          )
          .join("")
      : "<small>Chưa ai chia sẻ vị trí.</small>";
  }
  async function loadLocations() {
    try {
      const res = await fetch("/api/locations");
      if (!res.ok) throw 0;
      renderLocations(await res.json());
    } catch {
      $("#locationStatus").textContent =
        "Cần chạy 04-location.sql trước khi dùng bản đồ.";
    }
  }
  loadLocations();
  const locationSocket = window.io ? window.io() : null;
  locationSocket?.on("location:update", (location) => {
    loadLocations();
    $("#locationStatus").textContent =
      `Đã cập nhật vị trí của ${location.userName}.`;
  });
  $("#shareLocation").onclick = () => {
    if (!navigator.geolocation) {
      $("#locationStatus").textContent = "Trình duyệt không hỗ trợ định vị.";
      return;
    }
    const name = $("#senderInput")?.value.trim() || "Người thương";
    $("#locationStatus").textContent = "Đang xin quyền định vị...";
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const data = {
          userName: name,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        try {
          if (locationSocket?.connected)
            locationSocket.emit("location:update", data);
          else {
            const response = await fetch("/api/locations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (!response.ok) throw 0;
            await loadLocations();
          }
          $("#locationStatus").textContent =
            "Đã chia sẻ vị trí gần nhất của bạn.";
        } catch {
          $("#locationStatus").textContent =
            "Không lưu được vị trí. Kiểm tra SQL Server và chạy script 04.";
        }
      },
      () =>
        ($("#locationStatus").textContent =
          "Bạn chưa cấp quyền định vị. Vị trí không được gửi. "),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };
  const style = document.createElement("style");
  style.textContent =
    '.crystal-heart{position:absolute;top:0;width:135px;height:120px;transform-style:preserve-3d;animation:orbitHeart 4s ease-in-out infinite}.crystal-heart span,.crystal-heart i{position:absolute;font:145px/1 Georgia;color:#d75572;text-shadow:9px 12px 0 #792e42,18px 22px 28px #42202f85;transform:rotateY(-24deg) rotateZ(-6deg)}.crystal-heart i{color:#ffb0c0;opacity:.5;transform:translateZ(25px) rotateY(-24deg) rotateZ(-6deg);filter:blur(1px)}@keyframes orbitHeart{50%{transform:translateY(-15px) rotateY(24deg) scale(1.07)}}.companion-panel{grid-column:1/-1;display:grid;grid-template-columns:.8fr 1.2fr;gap:16px;margin-top:28px}.daily-card,.location-card{background:var(--card);border:1px solid var(--line);padding:20px;box-shadow:var(--shadow)}.daily-card strong,.location-card strong{display:block;font:600 20px/1.25 "Playfair Display";margin-bottom:12px}.daily-card button,.location-card button{border:1px solid #cba7a6;background:transparent;border-radius:20px;padding:7px 11px;color:var(--dark);cursor:pointer;font:11px "Plus Jakarta Sans"}.moods{margin:15px 0 8px;display:flex;gap:7px}.moods button{font-size:18px;border-color:var(--line)}.location-card{display:grid;grid-template-columns:1fr auto;gap:15px}.location-card>button{height:36px}.location-list{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}.location-list a{padding:9px 11px;border-radius:7px;background:#f1e7e0;color:var(--ink);text-decoration:none;display:grid;gap:3px;font-size:11px}.location-list span{color:var(--muted);font-size:9px}.memory.is-favorite:after{content:"♥";position:absolute;right:13px;top:13px;color:#bc5369;font-size:21px;text-shadow:0 1px 3px #fff}.modal-actions{position:absolute;bottom:24px;display:flex;gap:9px;left:50%;transform:translateX(-50%)}.modal-actions button,.modal-actions a{width:38px;height:38px;display:grid;place-items:center;border:1px solid #ffffff55;border-radius:50%;background:#27191fbb;color:#fff;text-decoration:none;cursor:pointer;font-size:18px}.modal-actions button:hover,.modal-actions a:hover{background:#b6546a}@media(max-width:800px){.companion-panel{grid-template-columns:1fr}.location-card{grid-template-columns:1fr}.location-card>button{width:max-content}}';
  style.textContent += '.heart-stage{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .18s ease-out}.crystal-heart b,.crystal-heart em{position:absolute;font:145px/1 Georgia;color:#f47f97;text-shadow:0 0 18px #ff8ca9a8;transform:translateZ(14px) rotateY(-24deg) rotateZ(-6deg)}.crystal-heart em{color:#ffe0e6;opacity:.65;transform:translateZ(38px) rotateY(-24deg) rotateZ(-6deg);filter:blur(2px)}.crystal-heart:before,.crystal-heart:after{content:"♥";position:absolute;font:145px/1 Georgia;color:#a73e57;transform:translateZ(-16px) rotateY(-24deg) rotateZ(-6deg)}.crystal-heart:after{color:#ed9bad;transform:translateZ(52px) rotateY(-24deg) rotateZ(-6deg);opacity:.35}';
  document.head.append(style);
})();
