const vm = require("vm"),
  fs = require("fs"),
  assert = require("assert/strict"),
  path = require("path");
(async () => {
  const { Chess } = await import(
    require("node:url").pathToFileURL(path.resolve("extension/vendor/chess.js"))
      .href
  );
  const source = fs
    .readFileSync("extension/background.js", "utf8")
    .replace(
      /^import\s+\{\s*Chess\s*\}\s+from\s+["']\.\/vendor\/chess\.js["'];?\s*/,
      "",
    );
  const fen = new Chess().fen();
  let handler,
    commands = [],
    prep = 0,
    stopOnClick = false;
  const sender = {
    tab: { id: 1, url: "https://www.chess.com/play/computer" },
    frameId: 0,
    url: "https://www.chess.com/play/computer",
  };
  function call(message) {
    return new Promise((resolve) => {
      if (handler(message, sender, resolve) !== true) resolve();
    });
  }
  const chrome = {
    runtime: { onMessage: { addListener: (fn) => (handler = fn) } },
    tabs: {
      get: async () => ({ active: true, url: sender.url }),
      sendMessage: async (id, message) => {
        if (message.type !== "autoplay-prepare") return;
        prep++;
        if (prep === 1)
          return { ok: true, from: { x: 10, y: 10 }, to: { x: 20, y: 20 } };
        return { ok: false, message: "Stellung hat sich geändert." };
      },
      onRemoved: { addListener: () => {} },
      onUpdated: { addListener: () => {} },
      onActivated: { addListener: () => {} },
    },
    debugger: {
      attach: async () => {},
      detach: async () => {},
      sendCommand: async (t, m, p) => {
        commands.push(p);
        if (stopOnClick && p.type === "mouseReleased")
          await call({ type: "autoplay-stop" });
      },
      onDetach: { addListener: () => {} },
    },
  };
  vm.runInNewContext(source, { chrome, Chess, setTimeout, console });
  assert.equal((await call({ type: "autoplay-start", side: "w" })).ok, true);
  let r = await call({ type: "autoplay-move", fen, uci: "e2e4" });
  assert.equal(r.ok, false);
  assert.equal(commands.length, 3);
  console.log("Changed FEN between clicks: destination click prevented");
  commands = [];
  prep = 0;
  stopOnClick = true;
  await call({ type: "autoplay-start", side: "w" });
  r = await call({ type: "autoplay-move", fen, uci: "e2e4" });
  assert.equal(r.ok, false);
  assert.equal(commands.length, 3);
  console.log("Stop between clicks: destination click prevented");
  commands = [];
  prep = 0;
  stopOnClick = false;
  await call({ type: "autoplay-start", side: "b" });
  r = await call({ type: "autoplay-move", fen, uci: "e2e4" });
  assert.equal(r.ok, false);
  assert.equal(commands.length, 0);
  console.log("Wrong side: no clicks");
  await call({ type: "autoplay-stop" });
  await call({ type: "autoplay-start", side: "w" });
  r = await call({ type: "autoplay-move", fen, uci: "e2e5" });
  assert.equal(r.ok, false);
  assert.equal(commands.length, 0);
  console.log("Illegal move: no clicks");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
