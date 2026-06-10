function renderOverview() {
  const opps = opportunities();
  const diffs = differences();
  shell("PM command center", `
    <div class="metric-strip">
      <article class="metric"><span>Retailers watched</span><strong>${retailers.length}</strong><small>Tractor Supply plus priority competitors</small></article>
      <article class="metric"><span>Screenshots saved</span><strong>${state.captures.length}</strong><small>Cart and checkout captures</small></article>
      <article class="metric"><span>Period differences</span><strong>${diffs.filter((item) => item.tone !== "good").length}</strong><small>${esc(state.from)} to ${esc(state.to)}</small></article>
      <article class="metric"><span>TSC opportunities</span><strong>${opps.length}</strong><small>Competitor-backed feature gaps</small></article>
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-header"><div><h3>Retailer watchlist</h3><p>Latest cart and checkout coverage by retailer.</p></div></div><div>${retailers.map((item) => {
        const cart = latest({ retailerId: item.id, surface: "cart" });
        const checkout = latest({ retailerId: item.id, surface: "checkout" });
        const gaps = missing(item.id);
        return `<article class="watch-row"><div><strong>${esc(item.name)}</strong><span>${esc(item.role)}</span></div><div><strong>${cart ? `Cart ${fmt(cart.at)}` : "Cart not captured"}</strong><span>${checkout ? `Checkout ${fmt(checkout.at)}` : "Checkout not captured"}</span></div>${badge(gaps.length ? `${gaps.length} gaps` : "covered", gaps.length ? "warn" : "good")}</article>`;
      }).join("")}</div></section>
      <section class="panel"><div class="panel-header"><div><h3>Tractor Supply opportunity queue</h3><p>Matrix-backed gaps where competitors are stronger.</p></div></div><div>${opps.slice(0, 8).map((item) => `<article class="opportunity-row"><div><strong>${esc(item.feature.label)}</strong><p>${esc(item.feature.group)} feature. TSC is ${labels[item.tsc].toLowerCase()}; seen as Yes for ${esc(item.examples.slice(0, 3).join(", "))}.</p></div>${badge(`${item.examples.length} retailers`, "warn")}</article>`).join("")}</div></section>
    </div>
    <section class="panel"><div class="panel-header"><div><h3>Change radar</h3><p>${esc(state.from)} compared with ${esc(state.to)}.</p></div></div><div>${diffRows(diffs.slice(0, 8))}</div></section>`);
}

function frame(label, capture) {
  return `<figure class="screenshot-frame"><figcaption><span>${esc(label)}</span><span>${capture ? esc(capture.period) : "No capture"}</span></figcaption>${capture ? `<img src="${esc(capture.src)}" alt="${esc(label)} screenshot">` : `<div class="screenshot-empty">No screenshot</div>`}</figure>`;
}

function optionList(selected) {
  return periods().map((period) => `<option value="${esc(period)}" ${period === selected ? "selected" : ""}>${esc(period)}</option>`).join("");
}

function renderCaptures() {
  const item = retailer();
  const oldShot = latest({ retailerId: item.id, surface: state.surface, device: state.device, period: state.from });
  const newShot = latest({ retailerId: item.id, surface: state.surface, device: state.device, period: state.to }) || latest({ retailerId: item.id, surface: state.surface, device: state.device });
  const captures = state.captures.filter((capture) => capture.retailerId === item.id);
  const note = !oldShot && !newShot ? "Add a cart or checkout screenshot to start comparison history." : !oldShot ? `No ${state.from} baseline exists for this view.` : !newShot ? `${state.to} is missing for this view.` : newShot.diff || "Both periods have screenshots.";
  shell("Screenshot capture and review", `
    <div class="retailer-toolbar"><div><p class="eyebrow">${esc(item.role)}</p><h3>${esc(item.name)}</h3><p>${captures.length} saved screenshots in this workspace</p></div><div class="control-row"><a class="link-action" href="${esc(item.url)}" target="_blank" rel="noreferrer">Open site</a><button class="secondary-action" data-view="matrix">Matrix</button></div></div>
    <div class="capture-layout"><div>
      <section class="panel"><div class="panel-header"><div><h3>Period comparison</h3><p>${esc(state.from)} versus ${esc(state.to)} for ${surfaceName(state.surface).toLowerCase()}.</p></div><div class="segmented">${["cart", "checkout"].map((surface) => `<button data-surface="${surface}" class="${surface === state.surface ? "active" : ""}">${surfaceName(surface)}</button>`).join("")}</div></div>
      <div class="panel-body"><div class="field-grid"><label class="field">Compare from<select id="fromSelect">${optionList(state.from)}</select></label><label class="field">Compare to<select id="toSelect">${optionList(state.to)}</select></label><label class="field">Device<select id="deviceSelect"><option ${state.device === "desktop" ? "selected" : ""}>desktop</option><option ${state.device === "mobile" ? "selected" : ""}>mobile</option></select></label></div><div class="comparison-grid" style="margin-top:14px">${frame(`${state.from} ${surfaceName(state.surface)}`, oldShot)}${frame(`${state.to} ${surfaceName(state.surface)}`, newShot)}</div><div class="diff-note">${badge("info", "info")}<p><strong>Comparison:</strong> ${esc(note)}</p></div></div></section>
      <section class="panel"><div class="panel-header"><div><h3>Screenshot library</h3><p>Saved captures for ${esc(item.name)}.</p></div></div><div>${captures.length ? captures.map((capture) => `<article class="capture-row"><div><strong>${surfaceName(capture.surface)} ${esc(capture.device)} - ${esc(capture.period)}</strong><span>${fmt(capture.at)}${capture.notes ? ` - ${esc(capture.notes)}` : ""}</span></div>${badge(capture.seed ? "seed" : "saved", capture.seed ? "info" : "good")}<button class="icon-button" data-delete="${capture.id}" ${capture.seed ? "disabled" : ""}>X</button></article>`).join("") : `<p class="empty-state">No screenshots saved for this retailer yet.</p>`}</div></section>
    </div><aside class="panel"><div class="panel-header"><div><h3>Add screenshot</h3><p>Capture is stored in this browser workspace.</p></div></div><div class="panel-body"><div class="field-grid" style="grid-template-columns:1fr"><label class="field">Period<input id="uploadPeriod" value="${esc(state.uploadPeriod)}"></label><label class="field">Screen<select id="uploadSurface"><option value="cart" ${state.surface === "cart" ? "selected" : ""}>Cart</option><option value="checkout" ${state.surface === "checkout" ? "selected" : ""}>Checkout</option></select></label><label class="field">Device<select id="uploadDevice"><option value="desktop" ${state.device === "desktop" ? "selected" : ""}>Desktop</option><option value="mobile" ${state.device === "mobile" ? "selected" : ""}>Mobile</option></select></label><label class="field">PM notes<textarea id="notes" placeholder="Fulfillment, promo, subscription, payment, or friction notes."></textarea></label></div><input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><div class="drop-zone" id="dropZone" tabindex="0" aria-label="Paste or drop screenshot"><div><strong>Paste screenshot</strong><span>Clipboard, PNG, JPEG, or WebP</span></div></div><button class="primary-action" id="saveShot" style="width:100%;margin-top:12px">Choose file</button></div></aside></div>`);
  bindCaptureControls();
}

function renderMatrix() {
  const group = state.matrixFilter;
  const search = state.matrixSearch.toLowerCase();
  const rows = retailers.filter((item) => !search || item.name.toLowerCase().includes(search) || item.role.toLowerCase().includes(search));
  const cols = features.filter((feature) => group === "all" || feature.group.toLowerCase() === group);
  shell("Cart and checkout feature matrix", `<div class="matrix-toolbar"><div class="segmented">${["all", "cart", "checkout"].map((item) => `<button data-filter="${item}" class="${group === item ? "active" : ""}">${item[0].toUpperCase() + item.slice(1)}</button>`).join("")}</div><label class="matrix-search"><input id="matrixSearch" type="search" value="${esc(state.matrixSearch)}" placeholder="Filter retailers"></label></div><div class="table-wrap"><table><thead><tr><th>Retailer</th><th>Role</th>${cols.map((feature) => `<th>${esc(feature.group)}<br>${esc(feature.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((item) => `<tr><th>${esc(item.name)}</th><td>${esc(item.role)}</td>${cols.map((feature) => {
    const status = state.matrix[item.id][feature.id] || "unknown";
    return `<td><button class="status-cell ${status}" data-cell="${item.id}:${feature.id}">${labels[status]}</button></td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`);
  $$('[data-filter]').forEach((button) => button.onclick = () => {
    state.matrixFilter = button.dataset.filter;
    renderMatrix();
  });
  $("#matrixSearch").oninput = (event) => {
    state.matrixSearch = event.target.value;
    renderMatrix();
  };
  $$('[data-cell]').forEach((button) => button.onclick = () => {
    const [retailerId, featureId] = button.dataset.cell.split(":");
    const current = state.matrix[retailerId][featureId] || "unknown";
    const next = statusOrder[(statusOrder.indexOf(current) + 1) % statusOrder.length];
    state.matrix[retailerId][featureId] = next;
    recordFeatureObservation(retailerId, featureId, next);
    write(storage.matrix, state.matrix);
    renderMatrix();
    toast("Feature matrix saved.");
  });
}

function diffRows(rows) {
  return rows.length ? rows.map((row) => `<article class="diff-row">${badge(row.tone, row.tone)}<div><strong>${esc(row.retailer.name)} ${surfaceName(row.surface)} ${esc(row.device)}</strong><p>${esc(row.text)}</p></div>${badge(row.newShot?.period || row.oldShot?.period || "")}</article>`).join("") : `<p class="empty-state">No period differences for the selected periods.</p>`;
}

function renderReports() {
  const rows = differences();
  const selectedFeature = featureById(state.featureId);
  const featureRows = featureReportRows();
  shell("Period and feature reports", `<div class="report-grid"><section class="panel"><div class="panel-header"><div><h3>Report controls</h3><p>Period and feature selectors feed the reports below.</p></div></div><div class="panel-body"><div class="period-controls"><label class="field">From period<select id="reportFrom">${optionList(state.from)}</select></label><label class="field">To period<select id="reportTo">${optionList(state.to)}</select></label><label class="field">Feature<select id="featureSelect">${features.map((feature) => `<option value="${feature.id}" ${feature.id === state.featureId ? "selected" : ""}>${esc(feature.group)} - ${esc(feature.label)}</option>`).join("")}</select></label><label class="field">Include<select id="featureStatusSelect"><option value="yes" ${state.featureStatus === "yes" ? "selected" : ""}>Yes only</option><option value="yes-partial" ${state.featureStatus === "yes-partial" ? "selected" : ""}>Yes and Partial</option></select></label></div><div class="diff-note">${badge(`${featureRows.length} retailers`, "info")}<p><strong>${esc(selectedFeature.label)}:</strong> retailers currently marked ${state.featureStatus === "yes" ? "Yes" : "Yes or Partial"} in the feature matrix, with the first date we noticed the feature.</p></div></div></section><section class="panel"><div class="panel-header"><div><h3>Feature availability report</h3><p>${esc(selectedFeature.group)} feature tracked from the matrix.</p></div></div><div>${featureRows.length ? featureRows.map((row) => `<article class="capture-row"><div><strong>${esc(row.retailer.name)}</strong><span>First noticed ${fmt(row.firstSeen)}. Last confirmed ${fmt(row.lastSeen)}. ${esc(row.source)}.</span></div>${badge(labels[row.status], statusTone(row.status))}<a class="link-action" href="${esc(row.retailer.url)}" target="_blank" rel="noreferrer">Open site</a></article>`).join("") : `<p class="empty-state">No retailers currently match this feature filter.</p>`}</div></section></div><div style="margin-top:18px"><section class="panel"><div class="panel-header"><div><h3>Period differences</h3><p>Missing, new, and changed screenshots by retailer.</p></div></div><div>${diffRows(rows)}</div></section></div><div style="margin-top:18px"><section class="panel"><div class="panel-header"><div><h3>Opportunity queue</h3><p>Feature matrix gaps to consider for TSC.</p></div></div><div>${opportunities().map((item) => `<article class="opportunity-row"><div><strong>${esc(item.feature.label)}</strong><p>Seen at ${esc(item.examples.join(", "))}; TSC is ${labels[item.tsc].toLowerCase()}.</p></div>${badge(`${item.examples.length} retailers`, "warn")}</article>`).join("")}</div></section></div>`);
  $("#reportFrom").onchange = (event) => {
    state.from = event.target.value;
    savePrefs();
    renderReports();
  };
  $("#reportTo").onchange = (event) => {
    state.to = event.target.value;
    savePrefs();
    renderReports();
  };
  $("#featureSelect").onchange = (event) => {
    state.featureId = event.target.value;
    savePrefs();
    renderReports();
  };
  $("#featureStatusSelect").onchange = (event) => {
    state.featureStatus = event.target.value;
    savePrefs();
    renderReports();
  };
}

