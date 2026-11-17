const { chromium } = require("playwright"),
  fs = require("fs"),
  assert = require("assert/strict");
(async () => {
  const b = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  try {
    const p = await b.newPage();
    const errors = [];
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("https://www.chess.com/**", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: '<wc-chess-board style="display:block;width:400px;height:400px"></wc-chess-board>',
      }),
    );
    await p.route("https://fixture-extension.test/**", async (r) => {
      await new Promise((resolve) => setTimeout(resolve, 1400));
      await r.fulfill({
        contentType: "text/html",
        body: `<script>window.received=[];addEventListener('message',e=>received.push(e.data));addEventListener('load',()=>parent.postMessage({type:'chess-ready'},'https://www.chess.com'));addEventListener('pagehide',()=>parent.postMessage({type:'chess-panel-unloading'},'https://www.chess.com'));</script>`,
      });
    });
    await p.goto("https://www.chess.com/play/online");
    await p.evaluate(() => {
      window.chrome = {
        runtime: {
          id: "fixture",
          getURL: (n) => "https://fixture-extension.test/" + n,
          onMessage: { addListener: () => {} },
          sendMessage: async () => ({ ok: true, active: false }),
        },
      };
    });
    for (const name of ["round-ui.js", "content.js"])
      await p.addScriptTag({
        content: fs.readFileSync("extension/" + name, "utf8"),
      });
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    await p.evaluate((fen) => {
      for (let n = 1; n <= 30; n++)
        document.dispatchEvent(
          new CustomEvent("local-chess-fen", {
            detail: fen.replace(/1$/, String(n)),
          }),
        );
    }, fen);
    await p.waitForTimeout(1800);
    let f = await (await p.$("#local-chess-overlay")).contentFrame();
    await f.waitForFunction(() => received.some((m) => m.type === "chess-fen"));
    let messages = await f.evaluate(() => received);
    assert.ok(messages.some((m) => m.type === "autoplay-state"));
    assert.ok(
      messages
        .filter((m) => m.type === "chess-fen")
        .every((m) => m.fen.endsWith(" 30")),
    );
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      "Delayed iframe load: no origin errors; only latest FEN delivered after readiness",
    );
    await p.$eval("#local-chess-overlay", (el) => {
      el.src += "?reload";
    });
    await p.waitForTimeout(1700);
    f = await (await p.$("#local-chess-overlay")).contentFrame();
    await f.waitForFunction(() => received.some((m) => m.type === "chess-fen"));
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log("Panel reload: readiness restored, no origin errors");
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
