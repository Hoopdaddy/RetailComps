const DEFAULT_LIBRARY_PATH = "data/screenshot-library.json";
const DEFAULT_REPOSITORY = "Hoopdaddy/RetailComps";
const DEFAULT_BRANCH = "main";
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;

function token() {
  return process.env.RETAILCOMPS_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
}

function repository() {
  return process.env.RETAILCOMPS_GITHUB_REPOSITORY || process.env.GITHUB_REPOSITORY || DEFAULT_REPOSITORY;
}

function branch() {
  return process.env.RETAILCOMPS_GITHUB_BRANCH || process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
}

function libraryPath() {
  return process.env.RETAILCOMPS_SCREENSHOT_LIBRARY_PATH || DEFAULT_LIBRARY_PATH;
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function encodePath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function safeSegment(value, fallback = "unknown") {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
}

function githubHeaders() {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token()}`,
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "retailcomps-screenshot-library"
  };
}

async function githubContents(path, options = {}) {
  const url = new URL(`https://api.github.com/repos/${repository()}/contents/${encodePath(path)}`);
  if (options.ref !== false) url.searchParams.set("ref", branch());
  const response = await fetch(url, { ...options, headers: { ...githubHeaders(), ...(options.headers || {}) } });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GitHub request failed: ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return response.json();
}

async function readContent(path) {
  const payload = await githubContents(path);
  if (!payload) return null;
  const content = Buffer.from(String(payload.content || "").replace(/\s/g, ""), "base64");
  return { sha: payload.sha, content };
}

async function writeContent(path, content, message, sha) {
  const body = {
    message,
    branch: branch(),
    content: Buffer.isBuffer(content) ? content.toString("base64") : Buffer.from(String(content)).toString("base64")
  };
  if (sha) body.sha = sha;

  const response = await fetch(`https://api.github.com/repos/${repository()}/contents/${encodePath(path)}`, {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = new Error(`GitHub write failed: ${response.status}`);
    error.status = response.status;
    error.body = await response.text();
    throw error;
  }

  return response.json();
}

async function readLibrary() {
  const file = await readContent(libraryPath());
  if (!file) return { sha: null, library: { version: 1, updatedAt: null, captures: [] } };
  try {
    const library = JSON.parse(file.content.toString("utf8"));
    if (!Array.isArray(library.captures)) library.captures = [];
    return { sha: file.sha, library };
  } catch {
    return { sha: file.sha, library: { version: 1, updatedAt: null, captures: [] } };
  }
}

function normalizeCapture(capture) {
  if (!capture.path) return capture;
  return {
    ...capture,
    src: `/api/screenshots?image=${encodeURIComponent(capture.path)}`,
    storage: "github",
    library: true
  };
}

async function appendCapture(capture) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { sha, library } = await readLibrary();
    const captures = library.captures.filter((item) => item.id !== capture.id && item.path !== capture.path);
    const next = {
      version: 1,
      updatedAt: capture.at,
      captures: [capture, ...captures]
    };

    try {
      await writeContent(libraryPath(), `${JSON.stringify(next, null, 2)}\n`, `Add ${capture.retailerId} screenshot metadata`, sha);
      return next;
    } catch (error) {
      if (error.status !== 409 || attempt === 2) throw error;
    }
  }
  throw new Error("Could not update screenshot library");
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i.exec(String(dataUrl || ""));
  if (!match) return null;
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
  const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  return { mimeType: match[1].toLowerCase(), extension: extensions[match[1].toLowerCase()], buffer };
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body);

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function handleGet(request, response) {
  const url = new URL(request.url || "/", `https://${request.headers.host || "localhost"}`);
  const imagePath = url.searchParams.get("image");

  if (imagePath) {
    if (!imagePath.startsWith("screenshots/") || imagePath.includes("..")) {
      sendError(response, 400, "Invalid screenshot path");
      return;
    }

    const file = await readContent(imagePath);
    if (!file) {
      sendError(response, 404, "Screenshot not found");
      return;
    }

    const extension = imagePath.split(".").pop();
    const types = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
    response.statusCode = 200;
    response.setHeader("content-type", types[extension] || "application/octet-stream");
    response.setHeader("cache-control", "public, max-age=3600");
    response.end(file.content);
    return;
  }

  const { library } = await readLibrary();
  sendJson(response, 200, { ...library, captures: library.captures.map(normalizeCapture) });
}

async function handlePost(request, response) {
  const body = await readJsonBody(request);
  const image = parseDataUrl(body.imageDataUrl);
  if (!image) {
    sendError(response, 400, "Expected a PNG, JPEG, or WebP image under 7 MB");
    return;
  }

  const input = body.capture || {};
  const at = input.at || new Date().toISOString();
  const retailerId = safeSegment(input.retailerId);
  const surface = safeSegment(input.surface, "screen");
  const device = safeSegment(input.device, "device");
  const period = String(input.period || "Unlabeled period").trim();
  const stamp = at.replace(/[^0-9]/g, "").slice(0, 14) || Date.now();
  const id = safeSegment(input.id, `${retailerId}-${surface}-${device}-${stamp}`);
  const path = `screenshots/${retailerId}/${surface}/${device}/${safeSegment(period, "period")}-${stamp}.${image.extension}`;
  const capture = {
    id,
    retailerId,
    surface,
    device,
    period,
    at,
    notes: String(input.notes || "").trim(),
    diff: String(input.diff || "").trim(),
    path,
    storage: "github"
  };

  await writeContent(path, image.buffer, `Add ${retailerId} ${surface} screenshot`, undefined);
  await appendCapture(capture);
  sendJson(response, 201, { capture: normalizeCapture(capture) });
}

async function handler(request, response) {
  try {
    if (!token()) {
      sendError(response, 503, "Screenshot library is not configured");
      return;
    }

    if (request.method === "GET") {
      await handleGet(request, response);
      return;
    }

    if (request.method === "POST") {
      await handlePost(request, response);
      return;
    }

    response.setHeader("allow", "GET, POST");
    sendError(response, 405, "Method not allowed");
  } catch (error) {
    sendError(response, error.status && error.status < 500 ? error.status : 500, "Screenshot library request failed");
  }
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb"
    }
  }
};
