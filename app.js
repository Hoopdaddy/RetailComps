function bindCaptureControls() {
  $$("[data-surface]").forEach((button) => button.onclick = () => {
    state.surface = button.dataset.surface;
    savePrefs();
    renderCaptures();
  });
  $("#fromSelect").onchange = (event) => {
    state.from = event.target.value;
    savePrefs();
    renderCaptures();
  };
  $("#toSelect").onchange = (event) => {
    state.to = event.target.value;
    savePrefs();
    renderCaptures();
  };
  $("#deviceSelect").onchange = (event) => {
    state.device = event.target.value;
    savePrefs();
    renderCaptures();
  };
  $("#saveShot").onclick = () => $("#fileInput").click();
  $("#dropZone").onclick = () => $("#dropZone").focus();
  $("#dropZone").onpaste = savePastedScreenshot;
  $("#dropZone").ondragover = (event) => {
    event.preventDefault();
    event.currentTarget.classList.add("dragging");
  };
  $("#dropZone").ondragleave = (event) => event.currentTarget.classList.remove("dragging");
  $("#dropZone").ondrop = (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove("dragging");
    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
    if (file) addCapture(file);
  };
  $("#fileInput").onchange = (event) => {
    if (event.target.files[0]) addCapture(event.target.files[0]);
  };
  $$("[data-delete]").forEach((button) => button.onclick = () => {
    state.captures = state.captures.filter((capture) => capture.id !== button.dataset.delete);
    saveCaptures();
    renderCaptures();
  });
}

function clipboardImageFile(event) {
  const itemFile = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .find(Boolean);
  return itemFile || Array.from(event.clipboardData?.files || []).find((file) => file.type.startsWith("image/"));
}

function savePastedScreenshot(event) {
  const file = clipboardImageFile(event);
  if (!file) return false;
  event.preventDefault();
  event.stopPropagation();
  addCapture(file);
  return true;
}

function isTextEntry(element) {
  return element?.matches?.("input, textarea, select, [contenteditable='true']");
}

function handleScreenshotPaste(event) {
  if (state.view !== "captures" || !$("#dropZone")) return;
  if (isTextEntry(document.activeElement)) return;
  savePastedScreenshot(event);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function optimizeScreenshotDataUrl(file) {
  return readFileAsDataUrl(file).then((source) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / image.width, maxEdge / image.height);
      if (source.length < 900000 && scale === 1) {
        resolve(source);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => resolve(source);
    image.src = source;
  }));
}

function addCapture(file) {
  optimizeScreenshotDataUrl(file).then((src) => {
    const surface = $("#uploadSurface").value;
    const device = $("#uploadDevice").value;
    const period = $("#uploadPeriod").value.trim() || "Unlabeled period";
    const previous = latest({ retailerId: state.retailerId, surface, device });
    const capture = {
      id: `${state.retailerId}-${surface}-${device}-${Date.now()}`,
      retailerId: state.retailerId,
      surface,
      device,
      period,
      at: new Date().toISOString(),
      src,
      notes: $("#notes").value.trim(),
      diff: previous ? `New ${surfaceName(surface).toLowerCase()} screenshot saved against ${previous.period}. Review fulfillment, promotions, subscriptions, payments, and friction.` : "First saved screenshot for this screen."
    };
    state.captures = byDate([capture, ...state.captures]);
    state.uploadPeriod = period;
    state.to = period;
    try {
      saveCaptures();
      savePrefs();
    } catch {
      state.captures = state.captures.filter((item) => item.id !== capture.id);
      toast("Screenshot could not be saved. Browser storage may be full, so remove older screenshots or use a smaller snip.");
      return;
    }
    renderCaptures();
    toast(`${surfaceName(surface)} screenshot saved.`);
  }).catch(() => toast("That screenshot could not be read from the clipboard."));
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 3000);
}

function runtimePeriodForDate(date = new Date()) {
  const month = date.toLocaleString("en", { month: "long" });
  const year = date.getFullYear();
  const firstDayOffset = new Date(year, date.getMonth(), 1).getDay();
  const week = Math.ceil((date.getDate() + firstDayOffset) / 7);
  return `${month} ${year} W${week}`;
}

function runtimePeriodRank(period) {
  const match = /^([A-Za-z]+)\s+(\d{4})\s+W(\d+)$/i.exec(period || "");
  if (!match) return -1;
  const month = new Date(`${match[1]} 1, ${match[2]}`).getMonth();
  return Number(match[2]) * 100 + month * 10 + Number(match[3]);
}

function syncRuntimeCurrentPeriod() {
  const current = runtimePeriodForDate();
  const currentRank = runtimePeriodRank(current);
  const uploadRank = runtimePeriodRank(state.uploadPeriod);
  if (state.uploadPeriod === current || uploadRank >= currentRank) return;
  state.from = state.to || state.uploadPeriod;
  state.to = current;
  state.uploadPeriod = current;
  try {
    savePrefs();
  } catch {
    // A full localStorage should not prevent the workbench from opening.
  }
}

const missionJokes = [
  "A promo code walked into checkout. Everyone applied themselves.",
  "The feature matrix asked for a raise. It said it had a lot of rows to manage.",
  "Cart audits are easier when the cart does not squeak.",
  "I told the SKU it was outstanding. It said it was just in stock.",
  "Checkout optimization: fewer clicks, more high-fives.",
  "The comparison report joined a band. It had great conversion rhythm.",
  "Why did the cart page bring a notebook? It wanted to capture everything.",
  "Retail math: two carts, no waiting, one happy PM.",
  "The checkout flow started stretching. It wanted a better funnel.",
  "A benchmark walked into a meeting and said, 'I brought receipts.'"
];

function setMissionJoke() {
  const target = $("#missionJoke");
  if (!target) return;
  const lastIndex = Number(sessionStorage.getItem("tsc-mission-joke-index"));
  let nextIndex = Math.floor(Math.random() * missionJokes.length);
  if (missionJokes.length > 1 && nextIndex === lastIndex) {
    nextIndex = (nextIndex + 1) % missionJokes.length;
  }
  sessionStorage.setItem("tsc-mission-joke-index", String(nextIndex));
  target.textContent = missionJokes[nextIndex];
}

function exportData() {
  const payload = { exportedAt: new Date().toISOString(), matrix: state.matrix, observations: state.observations, captures: state.captures.filter((capture) => !capture.seed && !capture.automated) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "tsc-cart-checkout-workbench.json";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  toast("Workspace export started.");
}

async function importData(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (payload.matrix) state.matrix = { ...state.matrix, ...payload.matrix };
    if (payload.observations) state.observations = { ...state.observations, ...payload.observations };
    if (Array.isArray(payload.captures)) state.captures = byDate([...seedCaptures, ...state.captures.filter((capture) => capture.automated), ...payload.captures.map((capture) => ({ ...capture, seed: false, automated: false }))]);
    write(storage.matrix, state.matrix);
    saveObservations();
    saveCaptures();
    render();
    toast("Workspace import complete.");
  } catch {
    toast("That import file could not be read.");
  }
}

function render() {
  if (state.view === "captures") renderCaptures();
  else if (state.view === "matrix") renderMatrix();
  else if (state.view === "reports") renderReports();
  else renderOverview();
}

Object.assign(state, read(storage.prefs, {}));
syncRuntimeCurrentPeriod();
loadCaptures();
bindViewButtons();
$("#resetOrderButton").onclick = () => toast("Retailer order is already reset.");
if ($("#exportButton")) $("#exportButton").onclick = exportData;
if ($("#importButton")) $("#importButton").onclick = () => $("#importFile").click();
if ($("#importFile")) $("#importFile").onchange = (event) => {
  if (event.target.files[0]) importData(event.target.files[0]);
  event.target.value = "";
};
document.addEventListener("paste", handleScreenshotPaste);
setMissionJoke();
render();

if (typeof loadAutomatedCaptures === "function") {
  loadAutomatedCaptures().then((count) => {
    if (count) render();
  });
}
