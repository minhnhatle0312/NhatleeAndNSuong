(() => {
  let installPrompt;
  const installButton = document.querySelector("#installBtn");
  const isInstalled = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (installButton && isIOS && !isInstalled) {
    installButton.hidden = false;
    installButton.textContent = "Cài app";
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installButton && !isInstalled) installButton.hidden = false;
  });
  installButton?.addEventListener("click", async () => {
    if (!installPrompt) {
      if (isIOS) alert("Trong Safari, chạm nút Chia sẻ rồi chọn Thêm vào màn hình chính để cài ứng dụng.");
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    installButton.hidden = true;
    installPrompt = null;
  });
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js").catch(() => {}));
  }
  const savedTheme = localStorage.getItem("memory-theme");
  if (savedTheme === "night") document.body.classList.add("night");
  document.querySelector("#themeBtn")?.addEventListener("click", () => {
    localStorage.setItem("memory-theme", document.body.classList.contains("night") ? "night" : "day");
  });
  const offlineNotice = document.createElement("div");
  offlineNotice.className = "offline-notice";
  offlineNotice.setAttribute("role", "status");
  offlineNotice.textContent = "Bạn đang ngoại tuyến · các nội dung đã tải vẫn có thể xem.";
  offlineNotice.hidden = navigator.onLine;
  document.body.append(offlineNotice);
  window.addEventListener("online", () => { offlineNotice.hidden = true; });
  window.addEventListener("offline", () => { offlineNotice.hidden = false; });
})();
