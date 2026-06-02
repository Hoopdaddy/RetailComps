const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
const files = [
  "index.html",
  "styles.css",
  "data.js",
  "views.js",
  "app.js"
];

fs.rmSync(output, { force: true, recursive: true });
fs.mkdirSync(output, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

const assets = path.join(root, "assets");
if (fs.existsSync(assets)) {
  fs.cpSync(assets, path.join(output, "assets"), { recursive: true });
}

console.log(`Static site copied to ${output}`);
