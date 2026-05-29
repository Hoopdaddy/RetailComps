const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.argv[2] || process.env.PORT || 4174);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function send(response, statusCode, body, type = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "content-type": type,
    "cache-control": "no-store"
  });
  response.end(body);
}

function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
  const requestPath = cleanPath || "index.html";
  const absolutePath = path.resolve(root, requestPath);

  if (!absolutePath.startsWith(root)) {
    return null;
  }

  return absolutePath;
}

const server = http.createServer((request, response) => {
  const absolutePath = resolveRequestPath(request.url || "/");
  if (!absolutePath) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.readFile(absolutePath, (error, buffer) => {
    if (error) {
      fs.readFile(path.join(root, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          send(response, 404, "Not found");
          return;
        }
        send(response, 200, fallback, mimeTypes[".html"]);
      });
      return;
    }

    const extension = path.extname(absolutePath).toLowerCase();
    send(response, 200, buffer, mimeTypes[extension] || "application/octet-stream");
  });
});

server.listen(port, () => {
  console.log(`Tractor Supply PM workbench running at http://localhost:${port}/#cart-checkout`);
});
