const vm = require("vm"),
  fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
(async () => {
  const { Chess } = await import(
    require("node:url").pathToFileURL(path.resolve("extension/vendor/chess.js"))
      .href
  );
  let handler,
    preparations = 0;
  const chrome = {
    runtime: { onMessage: { addListener: (fn) => (handler = fn) } },
    tabs: {
      get: async () => ({
        active: true,
        url: "https://www.chess.com/play/online",
      }),
      sendMessage: async (id, m) => {
        if (m.type === "autoplay-prepare-next") preparations++;
      },
      onRemoved: { addListener: () => {} },
      onUpdated: { addListener: () => {} },
      onActivated: { addListener: () => {} },
    },
    debugger: {
      attach: async () => {},
      detach: async () => {},
      sendCommand: async () => {},
      onDetach: { addListener: () => {} },
    },
  };
  vm.runInNewContext(
    fs
      .readFileSync("extension/background.js", "utf8")
      .replace(
        /^import\s+\{\s*Chess\s*\}\s+from\s+["']\.\/vendor\/chess\.js["'];?\s*/,
        "",
      ),
    { Chess, chrome, setTimeout, console, URL },
  );
  const sender = {
    tab: { id: 1, url: "https://www.chess.com/play/online" },
    url: "https://www.chess.com/play/online",
    frameId: 0,
  };
  const call = (m) => new Promise((resolve) => handler(m, sender, resolve));
  const start = (settings) =>
    call({
      type: "autoplay-start",
      side: "w",
      mode: "auto",
      repeat: true,
      settings,
    });
  await start({ onlyWins: true, maxGames: 1, pauseSeconds: 0 });
  let r = await call({
    type: "autoplay-finish",
    fen: new Chess().fen(),
    outcome: "win",
  });
  assert.equal(r.continue, false);
  assert.equal(r.stats.games, 1);
  assert.equal(r.stats.wins, 1);
  r = await call({
    type: "autoplay-finish",
    fen: new Chess().fen(),
    outcome: "win",
  });
  assert.equal(r.stats.games, 1);
  console.log("Game limit and duplicate-result guard: passed");
  await call({ type: "autoplay-stop" });
  await start({ onlyWins: true, maxGames: 0, pauseSeconds: 5 });
  r = await call({
    type: "autoplay-finish",
    fen: new Chess().fen(),
    outcome: "win",
  });
  assert.ok(r.continue);
  assert.ok(r.notBefore > Date.now() + 4000);
  await call({ type: "autoplay-next", fen: new Chess().fen() });
  assert.equal(preparations, 0);
  console.log("Pause: no next-game clicks before deadline");
  r = await call({ type: "autoplay-round" });
  assert.equal(r.ok, false);
  console.log("Unconfirmed 5+0: new-round play blocked");
  await call({ type: "autoplay-stop" });
  await start({ onlyWins: true });
  r = await call({
    type: "autoplay-finish",
    fen: new Chess().fen(),
    outcome: "unknown",
  });
  assert.equal(r.continue, false);
  console.log("Unknown result: no automatic queue after unconfirmed victory");
  await call({ type: "autoplay-stop" });
  await start({ onlyWins: false });
  r = await call({
    type: "autoplay-finish",
    fen: new Chess().fen(),
    outcome: "draw",
  });
  assert.equal(r.continue, true);
  assert.equal(r.stats.draws, 1);
  console.log("Optional continuation after draw: passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
