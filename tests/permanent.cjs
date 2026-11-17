const { chromium } = require("playwright");
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
(async () => {
  const ext = path.resolve("extension");
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
  });
  try {
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
    const cdp = await context.newCDPSession(page);
    const vm = require("vm");
    const { Chess } = await import(
      require("node:url").pathToFileURL(path.join(ext, "vendor/chess.js")).href
    );
    let backgroundListener, onUpdate;
    const fakeChrome = {
      runtime: {
        onMessage: { addListener: (fn) => (backgroundListener = fn) },
      },
      tabs: {
        get: async () => ({ active: true, url: page.url() }),
        update: async (id, { url }) => {
          await page.goto(url);
          return { id, url };
        },
        sendMessage: async (tabId, message) =>
          page.evaluate(
            (message) =>
              new Promise((resolve) => {
                let responded = false;
                const result = window.contentRuntimeListener(
                  message,
                  { id: "test-extension" },
                  (value) => {
                    responded = true;
                    window.lastPrepared = value;
                    resolve(value);
                  },
                );
                if (result !== true && !responded) resolve();
              }),
            message,
          ),
        onRemoved: { addListener: () => {} },
        onUpdated: { addListener: (fn) => (onUpdate = fn) },
        onActivated: { addListener: () => {} },
      },
      debugger: {
        attach: async () => {},
        detach: async () => {},
        sendCommand: async (target, method, params) => cdp.send(method, params),
        onDetach: { addListener: () => {} },
      },
    };
    vm.runInNewContext(
      fs
        .readFileSync(path.join(ext, "background.js"), "utf8")
        .replace(
          /^import\s+\{\s*Chess\s*\}\s+from\s+["']\.\/vendor\/chess\.js["'];?\s*/,
          "",
        ),
      { chrome: fakeChrome, Chess, setTimeout, console, URL },
    );
    await page.exposeFunction(
      "sendToBackground",
      (message) =>
        new Promise((resolve) => {
          const handled = backgroundListener(
            message,
            {
              tab: { id: 1, url: "https://www.chess.com/play/computer" },
              frameId: 0,
              url: "https://www.chess.com/play/computer",
            },
            resolve,
          );
          if (handled !== true) resolve();
        }),
    );
    let storedPreferences = {};
    await page.exposeFunction("readPrefs", () => ({
      overlayPreferences: storedPreferences,
    }));
    await page.exposeFunction("writePrefs", (data) => {
      storedPreferences = data.overlayPreferences;
    });
    await page.addInitScript(() => {
      window.chrome = {
        storage: {
          local: {
            get: () => window.readPrefs(),
            set: (data) => window.writePrefs(data),
          },
          onChanged: { addListener: () => {} },
        },
        runtime: {
          id: "test-extension",
          getURL: (p) => "https://fixture-extension.test/" + p,
          sendMessage: (message) => window.sendToBackground(message),
          onMessage: {
            addListener: (fn) => (window.contentRuntimeListener = fn),
          },
        },
      };
    });
    await context.route("https://fixture-extension.test/**", (route) => {
      const name = new URL(route.request().url()).pathname.slice(1);
      const file = path.join(ext, name);
      return route.fulfill({
        contentType: name.endsWith(".wasm")
          ? "application/wasm"
          : name.endsWith(".js")
            ? "text/javascript"
            : name.endsWith(".css")
              ? "text/css"
              : "text/html",
        body: fs.readFileSync(file),
      });
    });
    await context.route("https://www.chess.com/**", async (route) => {
      if (route.request().url().includes("/fixture-extension/")) {
        const name = new URL(route.request().url()).pathname.split("/").pop();
        return route.fulfill({
          contentType: "text/javascript",
          body: fs.readFileSync(path.join(ext, name), "utf8"),
        });
      }
      if (new URL(route.request().url()).pathname === "/play/online")
        return route.fulfill({
          contentType: "text/html",
          body: `<section class="new-game-component"><button data-cy="time-control" id="clock">10 min</button><div id="choices" hidden><button role="option" id="five">5 min</button><button role="option">5 + 3</button></div><button id="queue">Spielen</button></section><script>clock.onclick=()=>choices.hidden=false;five.onclick=e=>{clock.textContent='5 min';choices.hidden=true;sessionStorage.setItem('fiveTrusted',e.isTrusted)};queue.onclick=e=>{sessionStorage.setItem('queuedTime',clock.textContent);sessionStorage.setItem('queueTrusted',e.isTrusted);location.href='/game/live/fixture-round2'};</script><script src="/fixture-extension/bridge.js"></script><script src="/fixture-extension/round-ui.js"></script><script src="/fixture-extension/content.js"></script>`,
        });
      if (route.request().url().endsWith("/fixture-chess.js"))
        return route.fulfill({
          contentType: "text/javascript",
          body: fs.readFileSync(path.join(ext, "vendor/chess.js"), "utf8"),
        });
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><style>body{margin:0}wc-chess-board{display:block;position:absolute;left:30px;top:60px;width:640px;height:640px;background:repeating-conic-gradient(#d7c8aa 0% 25%,#7c9577 0% 50%) 0 / 160px 160px}.piece{position:absolute;width:80px;height:80px;display:grid;place-items:center;font:32px sans-serif;pointer-events:none}</style><wc-chess-board></wc-chess-board><script type="module">
 import {Chess} from '/fixture-chess.js';const game=new Chess();const board=document.querySelector('wc-chess-board');
 board.game={getFEN:()=>game.fen()};window.fixture={game,clicks:[],moves:0,own:location.pathname.includes('round2')?'black':'white',newClicks:0,playClicks:0,holdNext:false};board.game.getPlayingAs=()=>fixture.own;let selected='';
 function render(){board.replaceChildren();for(const row of game.board())for(const p of row){if(!p)continue;const file=p.square.charCodeAt(0)-97,rank=8-Number(p.square[1]),flip=board.classList.contains('flipped');const d=document.createElement('div');d.className='piece '+p.color+p.type+' square-'+(file+1)+p.square[1];d.style.left=(flip?7-file:file)*80+'px';d.style.top=(flip?7-rank:rank)*80+'px';d.textContent=p.color+p.type;board.append(d);}}
 board.addEventListener('click',e=>{window.fixture.clicks.push({trusted:e.isTrusted,x:e.clientX,y:e.clientY});const r=board.getBoundingClientRect(),flip=board.classList.contains('flipped');let f=Math.floor((e.clientX-r.left)/80),rank=Math.floor((e.clientY-r.top)/80);if(flip){f=7-f;rank=7-rank;}const sq=String.fromCharCode(97+f)+(8-rank);if(selected){try{game.move({from:selected,to:sq,promotion:'q'});window.fixture.moves++;render();selected='';return;}catch{}}selected=game.get(sq)?.color===game.turn()?sq:'';});
 window.fixture.finish=()=>{
 game.load('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');board.dataset.gameOver='true';render();
 const modal=document.createElement('div');modal.className='game-over-modal';modal.style.cssText='position:fixed;left:900px;top:200px;width:200px;height:100px;background:white';
 const next=document.createElement('button');next.textContent='Neue Partie';next.style.cssText='width:200px;height:60px';modal.append(next);document.body.append(modal);
 next.onclick=e=>{fixture.newClicks++;fixture.newTrusted=e.isTrusted;modal.remove();const setup=document.createElement('section');setup.className='new-game-component';setup.style.cssText='position:fixed;left:900px;top:300px;width:200px;height:100px';
 const play=document.createElement('button');play.textContent='Spielen';play.style.cssText='width:200px;height:60px';setup.append(play);document.body.append(setup);play.hidden=fixture.holdNext;
 fixture.allowContinue=()=>play.hidden=false;
 play.onclick=e=>{fixture.playClicks++;fixture.playTrusted=e.isTrusted;game.reset();fixture.own=fixture.own==='white'?'black':'white';board.classList.toggle('flipped',fixture.own==='black');delete board.dataset.gameOver;setup.remove();render();};};
};
const unrelated=document.createElement('button');unrelated.textContent='Play';unrelated.style.cssText='position:fixed;left:720px;top:700px';unrelated.onclick=()=>{fixture.unrelatedClicked=true};document.body.append(unrelated);
 if(location.pathname.includes('round2'))board.classList.add('flipped');window.fixture.opponent=()=>{game.move(game.moves()[0]);render()};window.fixture.flip=()=>{board.classList.toggle('flipped');render()};render();
 </script><script src="/fixture-extension/bridge.js"></script><script src="/fixture-extension/round-ui.js"></script><script src="/fixture-extension/content.js"></script>`,
      });
    });
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame() && onUpdate)
        onUpdate(1, { status: "loading" });
    });
    await page.goto("https://www.chess.com/play/computer");
    await page.waitForFunction(() => !!window.fixture);

    const panel = page.frameLocator("#local-chess-overlay");
    await panel.locator("#time").selectOption("700");

    await panel
      .locator("#move")
      .filter({ hasText: /[a-zA-Z]/ })
      .waitFor();
    console.log("Extension panel and Stockfish loaded");
    await page.waitForFunction(
      () => fixture.moves === 1,
      {},
      { timeout: 15000 },
    );
    console.log("Default permanent mode: played without Start click");
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForFunction(
      () => fixture?.moves === 1,
      {},
      { timeout: 15000 },
    );
    console.log("Reload: automatically resumed on visible game board");
    await panel.locator("#quick-stop").click();
    await page.waitForTimeout(300);
    assert.equal(await panel.locator("#autostart").isChecked(), false);
    assert.equal(
      await panel
        .locator("#autostart")
        .evaluate(() =>
          chrome.storage.local
            .get("overlayPreferences")
            .then((x) => x.overlayPreferences.autostart),
        ),
      false,
    );
    await page.reload();
    await page.waitForFunction(() => !!window.fixture);
    await page.waitForTimeout(2300);
    assert.equal(await page.evaluate(() => fixture.moves), 0);
    console.log("Stop: preference saved off; reload did not restart");
    await panel.locator("#autostart").check();
    await page.waitForFunction(
      () => fixture.moves === 1,
      {},
      { timeout: 15000 },
    );
    console.log("Re-enabling permanent mode: started automatically");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    assert.equal(await panel.locator("#autostart").isChecked(), false);
    await page.reload();
    await page.waitForFunction(() => !!window.fixture);
    await page.waitForTimeout(2300);
    assert.equal(await page.evaluate(() => fixture.moves), 0);
    console.log("Escape: persistent disable survived reload");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
