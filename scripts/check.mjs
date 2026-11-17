import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const readJSON = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJSON("extension/manifest.json");
assert.equal(manifest.version, readJSON("package.json").version);
assert.equal(manifest.name, "x0_chessica");
assert.equal(manifest.manifest_version, 3);
for (const entry of manifest.content_scripts)
  for (const file of entry.js)
    assert.ok(existsSync(resolve("extension", file)), file);
assert.ok(existsSync(resolve("extension", manifest.background.service_worker)));
for (const folder of ["extension", "tests", "scripts"])
  for (const name of readdirSync(folder)) {
    if (!/\.(?:js|cjs|mjs)$/.test(name)) continue;
    const result = spawnSync(
      process.execPath,
      ["--check", `${folder}/${name}`],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
  }
assert.match(readFileSync("extension/panel.html", "utf8"), /lang="en"/);
for (const name of readdirSync("extension").filter(
  (n) => /\.(?:js|html|json)$/.test(n) && n !== "round-ui.js",
)) {
  const text = readFileSync(`extension/${name}`, "utf8");
  assert.ok(
    !/Automatik|gestoppt|Weiß|Schwarz|Partien|Stopp|Ungültig/.test(text),
    `Untranslated interface text in ${name}`,
  );
  assert.ok(
    !/\bart_v2_[A-Za-z0-9_]{15,}|appgprj_[a-f0-9]{32}/.test(text),
    `Unexpected hosting metadata in ${name}`,
  );
}
for (const [file, expected] of Object.entries(
  readJSON("third_party/checksums.json"),
)) {
  const actual = createHash("sha256").update(readFileSync(file)).digest("hex");
  assert.equal(actual, expected, `Third-party checksum mismatch: ${file}`);
}
console.log(
  "Manifest, English interface, JavaScript syntax, and third-party checksums passed.",
);
