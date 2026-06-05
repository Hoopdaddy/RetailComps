const automatedCaptureManifest = "automated-captures/manifest.json";
const automatedRetailers = [
  {
    id: "target",
    name: "Target",
    role: "Mass retail benchmark",
    url: "https://www.target.com/",
    color: "#cc0000"
  }
];

saveCaptures = function saveCapturesWithoutAutomated() {
  write(storage.captures, state.captures.filter((capture) => !capture.seed && !capture.automated));
};

function ensureAutomatedRetailers() {
  const savedMatrix = read(storage.matrix, {});
  const savedObservations = read(storage.observations, {});

  for (const item of automatedRetailers) {
    if (!retailers.some((retailerItem) => retailerItem.id === item.id)) {
      const afterChewy = retailers.findIndex((retailerItem) => retailerItem.id === "chewy") + 1;
      retailers.splice(afterChewy || retailers.length, 0, item);
    }

    if (!state.matrix[item.id]) {
      state.matrix[item.id] = {};
    }
    for (const feature of features) {
      state.matrix[item.id][feature.id] = savedMatrix[item.id]?.[feature.id] || state.matrix[item.id][feature.id] || "unknown";
    }

    if (!state.observations[item.id]) {
      state.observations[item.id] = savedObservations[item.id] || {};
    }
  }
}

function automatedCaptureSource(src) {
  if (!src || /^(data:|https?:|\/)/.test(src)) return src;
  return `automated-captures/${src.replace(/^\.?\//, "")}`;
}

function normalizeAutomatedCapture(capture) {
  if (!capture || !capture.retailerId || !capture.surface || !capture.src) return null;
  if (!["cart", "checkout"].includes(capture.surface)) return null;
  if (!retailers.some((item) => item.id === capture.retailerId)) return null;

  return {
    id: capture.id || `auto-${capture.retailerId}-${capture.surface}-${capture.at || Date.now()}`,
    retailerId: capture.retailerId,
    surface: capture.surface,
    device: capture.device || "desktop",
    period: capture.period || "Automated",
    at: capture.at || new Date().toISOString(),
    src: automatedCaptureSource(capture.src),
    notes: capture.notes || "Captured by weekly automation.",
    diff: capture.diff || `Automated ${surfaceName(capture.surface).toLowerCase()} screenshot loaded from the weekly monitor.`,
    automated: true
  };
}

async function loadAutomatedCaptures() {
  ensureAutomatedRetailers();

  try {
    const response = await fetch(`${automatedCaptureManifest}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return 0;

    const manifest = await response.json();
    const automatedCaptures = (manifest.captures || []).map(normalizeAutomatedCapture).filter(Boolean);
    const existingIds = new Set(state.captures.map((capture) => capture.id));
    const additions = automatedCaptures.filter((capture) => !existingIds.has(capture.id));

    if (!additions.length) return 0;

    state.captures = byDate([...additions, ...state.captures]);
    return additions.length;
  } catch {
    return 0;
  }
}
