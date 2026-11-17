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
    await p.route("https://www.chess.com/**", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: '<div class="game-over-modal"><button>New 10 min</button><button>New 5 + 3</button><button id="exact">New 5 min</button></div>',
      }),
    );
    await p.goto("https://www.chess.com/game/live/fixture");
    await p.addScriptTag({
      content: fs.readFileSync("extension/round-ui.js", "utf8"),
    });
    let r = await p.evaluate(() => ChessRoundUI.nextAction(0));
    assert.equal(r.kind, "direct5");
    assert.match(r.key, /new 5 min/);
    await p.locator("#exact").evaluate((e) => e.remove());
    r = await p.evaluate(() => ChessRoundUI.nextAction(0));
    assert.equal(r.kind, "navigate");
    assert.equal(r.url, "https://www.chess.com/play/online");
    console.log("Direct 5+0: selected; 10-minute and 5+3 actions rejected");
    await p.evaluate(() => {
      history.replaceState({}, "", "/play/online");
      document.body.innerHTML =
        '<section class="new-game-component"><button data-cy="time-control">5 + 3</button><button>Play</button></section>';
    });
    r = await p.evaluate(() => ChessRoundUI.nextAction(2));
    assert.equal(r.kind, "time-menu");
    await p
      .locator('[data-cy="time-control"]')
      .evaluate((e) => (e.textContent = "5 | 0"));
    r = await p.evaluate(() => ChessRoundUI.nextAction(3));
    assert.equal(r.kind, "play5");
    console.log("Play gated on confirmed 5+0, not 5+3");
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
