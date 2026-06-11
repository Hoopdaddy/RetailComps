const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
const files = [
  "index.html",
  "styles.css",
  "data.js",
  "automated-captures.js",
  "views.js",
  "app.js"
];

fs.rmSync(output, { force: true, recursive: true });
fs.mkdirSync(output, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

const directories = ["assets", "automated-captures", "data", "screenshots"];
for (const directory of directories) {
  const source = path.join(root, directory);
  if (fs.existsSync(source)) {
    fs.cpSync(source, path.join(output, directory), { recursive: true });
  }
}

console.log(`Static site copied to ${output}`);
