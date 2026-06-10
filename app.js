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
  $("#dropZone").onclick = () => $("#fileInput").click();
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

function addCapture(file) {
  const reader = new FileReader();
  reader.onload = () => {
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
      src: reader.result,
      notes: $("#notes").value.trim(),
      diff: previous ? `New ${surfaceName(surface).toLowerCase()} screenshot saved against ${previous.period}. Review fulfillment, promotions, subscriptions, payments, and friction.` : "First saved screenshot for this screen."
    };
    state.captures = byDate([capture, ...state.captures]);
    state.uploadPeriod = period;
    state.to = period;
    saveCaptures();
    savePrefs();
    renderCaptures();
    toast(`${surfaceName(surface)} screenshot saved.`);
  };
  reader.readAsDataURL(file);
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 3000);
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
loadCaptures();
bindViewButtons();
$("#resetOrderButton").onclick = () => toast("Retailer order is already reset.");
$("#exportButton").onclick = exportData;
$("#importFile").onchange = (event) => {
  if (event.target.files[0]) importData(event.target.files[0]);
  event.target.value = "";
};
setMissionJoke();
render();

if (typeof loadAutomatedCaptures === "function") {
  loadAutomatedCaptures().then((count) => {
    if (count) render();
  });
}
