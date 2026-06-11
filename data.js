const retailers = [
  ["tractor-supply", "Tractor Supply", "Owned experience", "https://www.tractorsupply.com/", "#c8102e"],
  ["chewy", "Chewy", "Pet category benchmark", "https://www.chewy.com/", "#0879bd"],
  ["lowes", "Lowe's", "Home improvement benchmark", "https://www.lowes.com/", "#005baa"],
  ["walmart", "Walmart", "Mass retail benchmark", "https://www.walmart.com/", "#0071dc"],
  ["home-depot", "Home Depot", "Home improvement benchmark", "https://www.homedepot.com/", "#f96302"],
  ["petsmart", "PetSmart", "Pet category benchmark", "https://www.petsmart.com/", "#0055a6"],
  ["amazon", "Amazon", "Marketplace benchmark", "https://www.amazon.com/", "#ff9900"],
  ["ace-hardware", "Ace Hardware", "Hardware co-op benchmark", "https://www.acehardware.com/", "#d71920"]
].map(([id, name, role, url, color]) => ({ id, name, role, url, color }));

const features = [
  ["cartFulfillment", "Cart", "Fulfillment selector"],
  ["cartInventory", "Cart", "Inventory/date promise"],
  ["cartPromo", "Cart", "Promo code"],
  ["cartSubscription", "Cart", "Subscription prompt"],
  ["cartRecommendations", "Cart", "Recommendations"],
  ["cartSave", "Cart", "Save for later"],
  ["cartProtection", "Cart", "Protection plan"],
  ["cartSticky", "Cart", "Sticky summary"],
  ["checkoutGuest", "Checkout", "Guest checkout"],
  ["checkoutGate", "Checkout", "Sign-in gate"],
  ["checkoutWallets", "Checkout", "Wallet buttons"],
  ["checkoutPaypal", "Checkout", "PayPal"],
  ["checkoutBnpl", "Checkout", "Financing/BNPL"],
  ["checkoutLoyalty", "Checkout", "Rewards prompt"],
  ["checkoutAddress", "Checkout", "Address validation"],
  ["checkoutPickup", "Checkout", "Pickup appointment"],
  ["checkoutSms", "Checkout", "SMS opt-in"]
].map(([id, group, label]) => ({ id, group, label }));

const labels = { yes: "Yes", partial: "Partial", no: "No", unknown: "Unknown" };
const statusOrder = ["yes", "partial", "no", "unknown"];
const storage = {
  matrix: "tsc-pm-matrix-v2",
  captures: "tsc-pm-captures-v2",
  prefs: "tsc-pm-prefs-v2",
  observations: "tsc-pm-feature-observations-v1"
};

function periodForDate(date = new Date()) {
  const month = date.toLocaleString("en", { month: "long" });
  const year = date.getFullYear();
  const firstDayOffset = new Date(year, date.getMonth(), 1).getDay();
  const week = Math.ceil((date.getDate() + firstDayOffset) / 7);
  return `${month} ${year} W${week}`;
}

function periodRank(period) {
  const match = /^([A-Za-z]+)\s+(\d{4})\s+W(\d+)$/i.exec(period || "");
  if (!match) return -1;
  const month = new Date(`${match[1]} 1, ${match[2]}`).getMonth();
  return Number(match[2]) * 100 + month * 10 + Number(match[3]);
}

const currentPeriod = periodForDate();

const seedMatrix = {
  "tractor-supply": ["yes", "partial", "yes", "no", "partial", "yes", "partial", "partial", "yes", "partial", "partial", "yes", "partial", "yes", "yes", "partial", "partial"],
  chewy: ["yes", "yes", "yes", "yes", "yes", "yes", "no", "partial", "partial", "yes", "yes", "yes", "partial", "yes", "yes", "no", "partial"],
  lowes: ["yes", "yes", "yes", "no", "partial", "yes", "yes", "yes", "yes", "partial", "yes", "yes", "yes", "yes", "yes", "yes", "partial"],
  walmart: ["yes", "yes", "partial", "yes", "yes", "yes", "yes", "partial", "partial", "partial", "yes", "yes", "yes", "yes", "yes", "yes", "yes"],
  "home-depot": ["yes", "yes", "yes", "no", "partial", "yes", "yes", "yes", "yes", "partial", "yes", "yes", "yes", "yes", "yes", "yes", "partial"],
  petsmart: ["yes", "partial", "yes", "yes", "yes", "partial", "no", "partial", "partial", "yes", "partial", "yes", "partial", "yes", "yes", "yes", "partial"],
  amazon: ["yes", "yes", "partial", "yes", "yes", "yes", "yes", "yes", "partial", "yes", "yes", "no", "yes", "yes", "yes", "yes", "yes"],
  "ace-hardware": ["yes", "partial", "yes", "no", "partial", "partial", "partial", "partial", "yes", "partial", "partial", "yes", "partial", "yes", "partial", "yes", "partial"]
};

let state = {
  view: "overview",
  retailerId: "tractor-supply",
  surface: "cart",
  device: "desktop",
  from: "May 2026 W5",
  to: currentPeriod,
  uploadPeriod: currentPeriod,
  matrixFilter: "all",
  matrixSearch: "",
  featureId: "cartFulfillment",
  featureStatus: "yes",
  matrix: loadMatrix(),
  observations: loadFeatureObservations(),
  captures: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const fmt = (value) => value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "No capture";
const retailer = (id = state.retailerId) => retailers.find((item) => item.id === id) || retailers[0];
const byDate = (items) => [...items].sort((a, b) => new Date(b.at) - new Date(a.at));
const surfaceName = (surface) => surface === "checkout" ? "Checkout" : "Cart";

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadMatrix() {
  const matrix = {};
  for (const item of retailers) {
    matrix[item.id] = {};
    features.forEach((feature, index) => matrix[item.id][feature.id] = seedMatrix[item.id]?.[index] || "unknown");
  }
  const saved = read(storage.matrix, {});
  for (const id of Object.keys(saved)) matrix[id] = { ...matrix[id], ...saved[id] };
  return matrix;
}

function savePrefs() {
  write(storage.prefs, {
    view: state.view,
    retailerId: state.retailerId,
    surface: state.surface,
    device: state.device,
    from: state.from,
    to: state.to,
    uploadPeriod: state.uploadPeriod,
    featureId: state.featureId,
    featureStatus: state.featureStatus
  });
}

function syncCurrentPeriod() {
  const currentRank = periodRank(currentPeriod);
  const uploadRank = periodRank(state.uploadPeriod);
  if (state.uploadPeriod === currentPeriod || uploadRank >= currentRank) return;
  state.from = state.to || state.uploadPeriod;
  state.to = currentPeriod;
  state.uploadPeriod = currentPeriod;
  savePrefs();
}

function featureById(featureId) {
  return features.find((feature) => feature.id === featureId) || features[0];
}

function seedFeatureDate(retailerId, featureId) {
  const feature = featureById(featureId);
  if (retailerId === "chewy" && feature.group === "Cart") return "2026-05-28T12:32:56.678Z";
  if (retailerId === "chewy") return "2026-05-27T22:05:58.150Z";
  if (retailerId === "lowes" && feature.group === "Cart") return "2026-05-27T19:24:27.413Z";
  if (retailerId === "lowes") return "2026-05-27T21:57:13.274Z";
  if (retailerId === "tractor-supply") return "2026-05-28T14:00:00.000Z";
  return feature.group === "Cart" ? "2026-05-28T16:00:00.000Z" : "2026-05-28T17:00:00.000Z";
}

function loadFeatureObservations() {
  const observations = {};
  for (const item of retailers) {
    observations[item.id] = {};
    features.forEach((feature, index) => {
      const status = seedMatrix[item.id]?.[index] || "unknown";
      if (status === "yes" || status === "partial") {
        const noticedAt = seedFeatureDate(item.id, feature.id);
        observations[item.id][feature.id] = {
          firstSeen: noticedAt,
          lastSeen: noticedAt,
          source: "Seeded matrix review"
        };
      }
    });
  }

  const saved = read(storage.observations, {});
  for (const retailerId of Object.keys(saved)) {
    observations[retailerId] = { ...(observations[retailerId] || {}), ...saved[retailerId] };
  }
  return observations;
}

function saveObservations() {
  write(storage.observations, state.observations);
}

function recordFeatureObservation(retailerId, featureId, status, at = new Date().toISOString()) {
  if (status !== "yes" && status !== "partial") return;
  if (!state.observations[retailerId]) state.observations[retailerId] = {};
  const previous = state.observations[retailerId][featureId];
  state.observations[retailerId][featureId] = {
    firstSeen: previous?.firstSeen || at,
    lastSeen: at,
    source: "Manual matrix update"
  };
  saveObservations();
}

function statusTone(status) {
  if (status === "yes") return "good";
  if (status === "partial") return "warn";
  if (status === "no") return "bad";
  return "info";
}

function featureReportRows() {
  const allowedStatuses = state.featureStatus === "yes" ? ["yes"] : ["yes", "partial"];
  return retailers
    .map((item) => {
      const status = state.matrix[item.id]?.[state.featureId] || "unknown";
      const observation = state.observations[item.id]?.[state.featureId];
      return {
        retailer: item,
        status,
        firstSeen: observation?.firstSeen || seedFeatureDate(item.id, state.featureId),
        lastSeen: observation?.lastSeen || observation?.firstSeen || seedFeatureDate(item.id, state.featureId),
        source: observation?.source || "Seeded matrix review"
      };
    })
    .filter((row) => allowedStatuses.includes(row.status))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "yes" ? -1 : 1;
      return new Date(a.firstSeen) - new Date(b.firstSeen);
    });
}

function sampleShot(name, surface, color, lines) {
  const rows = lines.map((line, index) => `<rect x="78" y="${192 + index * 62}" width="${index === 2 ? 420 : 520}" height="30" rx="7" fill="#e7edf4"/><text x="98" y="${213 + index * 62}" fill="#334155" font-size="20" font-family="Arial" font-weight="700">${esc(line)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600"><rect width="960" height="600" fill="#f8fafc"/><rect x="42" y="38" width="876" height="524" rx="20" fill="#fff" stroke="#d9e0e8"/><rect x="42" y="38" width="876" height="92" rx="20" fill="${color}"/><rect x="42" y="104" width="876" height="26" fill="${color}"/><text x="78" y="92" fill="#fff" font-size="34" font-family="Arial" font-weight="800">${esc(name)} ${esc(surface)}</text><rect x="610" y="176" width="248" height="290" rx="14" fill="#f1f5f9" stroke="#d9e0e8"/><rect x="638" y="214" width="192" height="24" rx="6" fill="#cbd5e1"/><rect x="638" y="262" width="150" height="18" rx="5" fill="#dbe3ec"/><rect x="638" y="302" width="174" height="18" rx="5" fill="#dbe3ec"/><rect x="638" y="390" width="192" height="48" rx="8" fill="${color}"/><text x="682" y="422" fill="#fff" font-size="19" font-family="Arial" font-weight="800">Continue</text>${rows}<rect x="78" y="438" width="452" height="58" rx="12" fill="#eef2f7" stroke="#d9e0e8"/><text x="104" y="475" fill="#64748b" font-size="18" font-family="Arial" font-weight="700">Seeded benchmark visual</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const seedCaptures = [
  ["chewy", "cart", "desktop", "May 2026 W5", "2026-05-28T12:32:56.678Z", sampleShot("Chewy", "Cart", "#0879bd", ["Autoship callout", "Free shipping meter", "Checkout summary"]), "First Chewy cart screenshot baseline."],
  ["chewy", "checkout", "desktop", "May 2026 W4", "2026-05-27T22:05:58.150Z", sampleShot("Chewy", "Checkout", "#0879bd", ["Sign-in prompt", "Wallet buttons", "Delivery confirmation"]), "First Chewy checkout baseline."],
  ["lowes", "cart", "desktop", "May 2026 W4", "2026-05-27T19:24:27.413Z", sampleShot("Lowe's", "Cart", "#005baa", ["Fulfillment selector", "Protection plan", "Sticky order summary"]), "Prior workspace noted a major cart layout change."],
  ["lowes", "checkout", "desktop", "May 2026 W5", "2026-05-27T21:57:13.274Z", sampleShot("Lowe's", "Checkout", "#005baa", ["Guest checkout", "Pickup details", "Payment options"]), "Checkout entry reference for Lowe's."]
].map(([retailerId, surface, device, period, at, src, notes], index) => ({
  id: `seed-${index}`,
  retailerId,
  surface,
  device,
  period,
  at,
  src,
  notes,
  seed: true,
  diff: index === 2 ? "Major visual change versus earlier Lowe's cart baseline." : "Baseline screenshot for this screen."
}));

function loadCaptures() {
  state.captures = byDate([...seedCaptures, ...read(storage.captures, []).filter((capture) => !capture.seed && !capture.library && capture.storage !== "github" && !capture.automated)]);
}

function saveCaptures() {
  write(storage.captures, state.captures.filter((capture) => !capture.seed && !capture.library && capture.storage !== "github" && !capture.automated));
}

function latest(filters) {
  return state.captures.find((capture) => Object.entries(filters).every(([key, value]) => !value || capture[key] === value));
}

function periods() {
  return [...new Set(["May 2026 W4", "May 2026 W5", currentPeriod, state.from, state.to, state.uploadPeriod, ...state.captures.map((capture) => capture.period)])]
    .filter(Boolean)
    .sort((a, b) => periodRank(a) - periodRank(b));
}

function missing(id) {
  return ["cart", "checkout"].filter((surface) => !latest({ retailerId: id, surface }));
}

function opportunities() {
  const owned = state.matrix["tractor-supply"];
  return features.map((feature) => {
    const examples = retailers.filter((item) => item.id !== "tractor-supply" && state.matrix[item.id][feature.id] === "yes").map((item) => item.name);
    return { feature, examples, tsc: owned[feature.id] };
  }).filter((item) => item.tsc !== "yes" && item.examples.length >= 2).sort((a, b) => b.examples.length - a.examples.length);
}

function differences() {
  const rows = [];
  for (const item of retailers) {
    for (const surface of ["cart", "checkout"]) {
      for (const device of ["desktop", "mobile"]) {
        const oldShot = latest({ retailerId: item.id, surface, device, period: state.from });
        const newShot = latest({ retailerId: item.id, surface, device, period: state.to });
        if (!oldShot && !newShot) continue;
        let tone = "good";
        let text = `${surfaceName(surface)} ${device}: both periods have coverage.`;
        if (newShot && !oldShot) {
          tone = "info";
          text = `${surfaceName(surface)} ${device}: new in ${state.to}; no ${state.from} baseline exists.`;
        } else if (!newShot && oldShot) {
          tone = "warn";
          text = `${surfaceName(surface)} ${device}: ${state.from} exists, but ${state.to} is missing.`;
        } else if (newShot?.diff) {
          tone = /major|missing/i.test(newShot.diff) ? "warn" : "info";
          text = newShot.diff;
        }
        rows.push({ retailer: item, surface, device, tone, text, oldShot, newShot });
      }
    }
  }
  return rows.sort((a, b) => ({ warn: 3, info: 2, good: 1 }[b.tone] - { warn: 3, info: 2, good: 1 }[a.tone]));
}

function badge(text, tone = "") {
  return `<span class="badge ${tone}">${esc(text)}</span>`;
}

function shell(title, body) {
  $("#viewShell").innerHTML = body;
  $("#pageHeading").textContent = title;
  $$(".mode-nav [data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  renderRetailers();
  bindViewButtons();
}

function renderRetailers() {
  $("#retailerList").innerHTML = retailers.map((item) => {
    const last = latest({ retailerId: item.id });
    const gaps = missing(item.id);
    return `<button class="retailer-row ${item.id === state.retailerId ? "active" : ""}" data-retailer="${item.id}" style="--retailer-color:${item.color}"><span class="retailer-color"></span><span><strong>${esc(item.name)}</strong><small>${last ? fmt(last.at) : esc(item.role)}</small></span><em>${last ? state.captures.filter((capture) => capture.retailerId === item.id).length : `${gaps.length} gaps`}</em></button>`;
  }).join("");
  $$("[data-retailer]").forEach((button) => button.onclick = () => {
    state.retailerId = button.dataset.retailer;
    state.view = "captures";
    savePrefs();
    render();
  });
}

function bindViewButtons() {
  $$("[data-view]").forEach((button) => button.onclick = () => {
    state.view = button.dataset.view;
    savePrefs();
    render();
  });
}

