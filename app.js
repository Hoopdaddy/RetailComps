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

function exportData() {
  const payload = { exportedAt: new Date().toISOString(), matrix: state.matrix, captures: state.captures.filter((capture) => !capture.seed) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "tsc-cart-checkout-workbench.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (payload.matrix) state.matrix = { ...state.matrix, ...payload.matrix };
    if (Array.isArray(payload.captures)) state.captures = byDate([...seedCaptures, ...payload.captures.map((capture) => ({ ...capture, seed: false }))]);
    write(storage.matrix, state.matrix);
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
$("#importButton").onclick = () => $("#importFile").click();
$("#importFile").onchange = (event) => event.target.files[0] && importData(event.target.files[0]);
render();
