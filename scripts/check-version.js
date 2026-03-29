const { execSync } = require("child_process");
const pkg = require("../package.json");

try {
  const tag = execSync("git describe --tags --exact-match", { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();

  const normalized = tag.startsWith("v") ? tag.slice(1) : tag;
  if (normalized !== pkg.version) {
    console.error(`Version mismatch: package.json=${pkg.version} git=${tag}`);
    process.exit(1);
  }
} catch {
  console.error("No exact git tag on HEAD. Expected v" + pkg.version);
  process.exit(1);
}
