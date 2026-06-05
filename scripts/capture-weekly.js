const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const outputRoot = path.join(root, "automated-captures");
const runDate = new Date();
const runId = process.env.CHECKOUT_MONITOR_RUN_ID || runDate.toISOString().slice(0, 10);
const runDir = path.join(outputRoot, runId);
const period = process.env.CHECKOUT_MONITOR_PERIOD || formatPeriod(runDate);
const settleMs = Number(process.env.CHECKOUT_MONITOR_SETTLE_MS || 1800);

const sites = [
  {
    id: "chewy",
    name: "Chewy",
    pickupSearchUrl: "https://www.chewy.com/s?query=dog+food",
    shippingSearchUrl: "https://www.chewy.com/s?query=cat+toy",
    cartUrl: "https://www.chewy.com/cart",
    note: "Chewy does not have store pickup, so the pickup item step is skipped."
  },
  {
    id: "target",
    name: "Target",
    pickupSearchUrl: "https://www.target.com/s?searchTerm=paper+towels",
    shippingSearchUrl: "https://www.target.com/s?searchTerm=phone+case",
    cartUrl: "https://www.target.com/cart"
  },
  {
    id: "tractor-supply",
    name: "Tractor Supply",
    pickupSearchUrl: "https://www.tractorsupply.com/tsc/catalog/search?q=bird+seed",
    shippingSearchUrl: "https://www.tractorsupply.com/tsc/catalog/search?q=work+gloves",
    cartUrl: "https://www.tractorsupply.com/tsc/cart"
  },
  {
    id: "walmart",
    name: "Walmart",
    pickupSearchUrl: "https://www.walmart.com/search?q=laundry+detergent",
    shippingSearchUrl: "https://www.walmart.com/search?q=bluetooth+speaker",
    cartUrl: "https://www.walmart.com/cart"
  }
];

function formatPeriod(date) {
  const month = new Intl.DateTimeFormat("en", { month: "short", timeZone: "America/Chicago" }).format(date);
  const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "America/Chicago" }).format(date);
  const day = Number(new Intl.DateTimeFormat("en", { day: "numeric", timeZone: "America/Chicago" }).format(date));
  return `${month} ${year} W${Math.ceil(day / 7)}`;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(settleMs);
}

async function gotoAndSettle(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await dismissPrompts(page);
  await settle(page);
}

async function clickFirst(locator, options = {}) {
  const limit = options.limit || 8;
  const count = await locator.count().catch(() => 0);

  for (let index = 0; index < Math.min(count, limit); index += 1) {
    const item = locator.nth(index);
    const visible = await item.isVisible().catch(() => false);
    const enabled = await item.isEnabled().catch(() => false);

    if (!visible || !enabled) continue;

    await item.scrollIntoViewIfNeeded().catch(() => {});
    try {
      await item.click({ timeout: options.timeout || 5000 });
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

async function clickAny(page, locators) {
  for (const locator of locators) {
    if (await clickFirst(locator)) return true;
  }
  return false;
}

async function dismissPrompts(page) {
  const prompts = [
    page.getByRole("button", { name: /accept|agree|allow all|got it|not now|no thanks/i }),
    page.getByLabel(/close|dismiss/i),
    page.locator("button[aria-label*='Close' i], button[aria-label*='Dismiss' i]")
  ];

  for (const locator of prompts) {
    await clickFirst(locator, { limit: 3, timeout: 2000 });
  }
}

async function chooseFulfillment(page, mode) {
  const pattern = mode === "pickup" ? /pick\s*up|pickup|store pickup|free pickup/i : /ship|shipping|delivery|ship to home/i;
  return clickAny(page, [
    page.getByRole("radio", { name: pattern }),
    page.getByRole("button", { name: pattern }),
    page.getByRole("tab", { name: pattern }),
    page.getByText(pattern)
  ]);
}

async function clickAddToCart(page) {
  return clickAny(page, [
    page.getByRole("button", { name: /add to (cart|basket)|add for delivery|add for pickup/i }),
    page.locator("button:has-text('Add to cart'), button:has-text('Add to Cart'), button:has-text('Add for delivery'), button:has-text('Add for pickup')"),
    page.locator("[data-test*='add' i], [data-testid*='add' i], [aria-label*='Add to cart' i]")
  ]);
}

async function clickFirstProduct(page) {
  return clickAny(page, [
    page.locator("a[data-testid*='product-title' i]"),
    page.locator("a[href*='/p/']:has(img), a[href*='/ip/']:has(img), a[href*='/dp/']:has(img)"),
    page.locator("a:has(img)").filter({ hasNotText: /sponsored|ad/i })
  ]);
}

async function addItem(page, site, mode, url, result) {
  await gotoAndSettle(page, url);
  await chooseFulfillment(page, mode);

  let added = await clickAddToCart(page);
  if (!added) {
    const openedProduct = await clickFirstProduct(page);
    if (openedProduct) {
      await settle(page);
      await dismissPrompts(page);
      await chooseFulfillment(page, mode);
      added = await clickAddToCart(page);
    }
  }

  if (added) {
    await settle(page);
    await dismissPrompts(page);
    result.observations.push(`${mode}: add-to-cart control clicked.`);
  } else {
    result.status = "partial";
    result.observations.push(`${mode}: no add-to-cart control was found; screenshots may show an incomplete cart.`);
  }
}

async function proceedToCheckout(page) {
  const clicked = await clickAny(page, [
    page.getByRole("button", { name: /checkout|check out|proceed to checkout|check out all/i }),
    page.getByRole("link", { name: /checkout|check out|proceed to checkout|check out all/i }),
    page.locator("button:has-text('Checkout'), button:has-text('Check out'), a:has-text('Checkout'), a:has-text('Check out')")
  ]);

  if (clicked) {
    await settle(page);
    await dismissPrompts(page);
  }

  return clicked;
}

async function maybeGuestCheckout(page, site, captures) {
  const clicked = await clickAny(page, [
    page.getByRole("button", { name: /guest|continue as guest|checkout as guest/i }),
    page.getByRole("link", { name: /guest|continue as guest|checkout as guest/i })
  ]);

  if (!clicked) return false;

  await settle(page);
  const fileName = `${site.id}-guest-checkout.png`;
  await page.screenshot({ path: path.join(runDir, fileName), fullPage: true });
  captures.push(fileName);
  return true;
}

async function saveCapture(page, site, surface, fileName, captures, notes) {
  await page.screenshot({ path: path.join(runDir, fileName), fullPage: true });
  captures.push({
    id: `auto-${runId}-${site.id}-${surface}`,
    retailerId: site.id,
    surface,
    device: "desktop",
    period,
    at: runDate.toISOString(),
    src: `${runId}/${fileName}`,
    notes,
    diff: `Automated ${surface} capture from ${period}. Review fulfillment, promotions, subscriptions, payment options, and checkout friction.`
  });
}

async function runSite(browser, site) {
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/Chicago",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
    viewport: { width: 1440, height: 1100 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  const result = {
    id: site.id,
    name: site.name,
    status: "captured",
    observations: site.note ? [site.note] : [],
    files: []
  };
  const captures = [];

  try {
    if (site.id === "chewy") {
      await addItem(page, site, "shipping", site.pickupSearchUrl, result);
    } else {
      await addItem(page, site, "pickup", site.pickupSearchUrl, result);
    }
    await addItem(page, site, "shipping", site.shippingSearchUrl, result);

    await gotoAndSettle(page, site.cartUrl);
    await saveCapture(page, site, "cart", `${site.id}-cart.png`, captures, "Captured automatically from the cart page after attempting two-item setup.");

    const checkoutReached = await proceedToCheckout(page);
    if (!checkoutReached) {
      result.status = "partial";
      result.observations.push("Checkout button was not found; checkout screenshot captures the current cart state.");
    }

    await saveCapture(page, site, "checkout", `${site.id}-checkout.png`, captures, "Captured automatically from the first checkout or checkout-entry page.");

    if (await maybeGuestCheckout(page, site, result.files)) {
      result.observations.push("Guest checkout step was visible and captured.");
    }
  } catch (error) {
    result.status = "partial";
    result.observations.push(`Automation stopped early: ${cleanText(error.message)}`);
    const errorFile = `${site.id}-automation-state.png`;
    await page.screenshot({ path: path.join(runDir, errorFile), fullPage: true }).catch(() => {});
    result.files.push(errorFile);
  } finally {
    await context.close();
  }

  result.files.push(...captures.map((capture) => capture.src.replace(`${runId}/`, "")));
  return { result, captures };
}

function readManifest() {
  const manifestPath = path.join(outputRoot, "manifest.json");
  if (!fs.existsSync(manifestPath)) return { runs: [], captures: [] };

  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return { runs: [], captures: [] };
  }
}

function writeManifest(results, captures) {
  const manifestPath = path.join(outputRoot, "manifest.json");
  const manifest = readManifest();
  const captureIds = new Set(captures.map((capture) => capture.id));
  const runIds = new Set([runId]);

  manifest.runs = [
    ...(manifest.runs || []).filter((run) => !runIds.has(run.id)),
    {
      id: runId,
      at: runDate.toISOString(),
      period,
      summary: `${runId}/summary.md`,
      results: results.map(({ id, name, status }) => ({ id, name, status }))
    }
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  manifest.captures = [
    ...(manifest.captures || []).filter((capture) => !captureIds.has(capture.id)),
    ...captures
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeSummary(results) {
  const lines = [
    "# Weekly Checkout Monitor",
    "",
    `Run: ${runDate.toISOString()}`,
    `Period: ${period}`,
    "",
    "## Results",
    ""
  ];

  for (const result of results) {
    lines.push(`- [${result.status}] ${result.name}`);
    for (const observation of result.observations) {
      lines.push(`  - ${observation}`);
    }
    if (result.files.length) {
      lines.push(`  - Files: ${result.files.join(", ")}`);
    }
  }

  fs.writeFileSync(path.join(runDir, "summary.md"), `${lines.join("\n")}\n`);
}

async function main() {
  fs.mkdirSync(runDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const allCaptures = [];

  try {
    for (const site of sites) {
      const { result, captures } = await runSite(browser, site);
      results.push(result);
      allCaptures.push(...captures);
    }
  } finally {
    await browser.close();
  }

  writeSummary(results);
  writeManifest(results, allCaptures);

  const captured = results.filter((result) => result.status === "captured").length;
  const partial = results.filter((result) => result.status === "partial").length;
  console.log(`Checkout monitor complete: ${captured} captured, ${partial} partial.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
