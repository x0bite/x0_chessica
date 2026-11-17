const assert = require("assert/strict"),
  path = require("path");
(async () => {
  const { parseVariation, pickVariation } = await import(
    require("node:url").pathToFileURL(path.resolve("extension/variation.js"))
      .href
  );
  const variants = new Map();
  for (const line of [
    "info depth 15 multipv 1 score cp 95 pv e2e4 e7e5",
    "info depth 15 multipv 2 score cp 60 pv d2d4 d7d5",
    "info depth 14 multipv 3 score cp -400 pv f2f3",
  ]) {
    const v = parseVariation(line);
    variants.set(v.index, v);
  }
  let result = pickVariation("e2e4", variants, true, () => 0);
  assert.equal(result.uci, "d2d4");
  assert.ok(result.varied);
  assert.equal(pickVariation("e2e4", variants, true, () => 0.9).uci, "e2e4");
  assert.equal(pickVariation("e2e4", variants, false, () => 0).uci, "e2e4");
  assert.equal(
    parseVariation("info depth 15 score cp 60 lowerbound pv e2e4"),
    null,
  );
  variants.get(1).kind = "mate";
  assert.equal(pickVariation("e2e4", variants, true, () => 0).uci, "e2e4");
  variants.get(1).kind = "cp";
  variants.get(1).score = -300;
  assert.equal(pickVariation("e2e4", variants, true, () => 0).uci, "e2e4");
  console.log(
    "Variation: bounded alternative, probability, off switch, mate and losing-position guards passed",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
