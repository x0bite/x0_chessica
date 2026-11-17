(() => {
  if (document.getElementById("local-chess-overlay")) return;
  const frame = document.createElement("iframe");
  frame.id = "local-chess-overlay";
  frame.src = chrome.runtime.getURL("panel.html");
  const origin = new URL(frame.src).origin;
  let panelReady = false;
  const pendingPanel = new Map();
  frame.title = "x0_chessica — move analysis";
  frame.style.cssText =
    "position:fixed;right:16px;top:90px;width:320px;height:590px;z-index:2147483647;border:1px solid #475569;border-radius:16px;box-shadow:0 16px 48px #0008;color-scheme:dark;";
  document.documentElement.append(frame);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.id = "local-chess-arrow";
  svg.setAttribute("viewBox", "0 0 8 8");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText =
    "position:fixed;pointer-events:none;z-index:2147483646;display:none;overflow:hidden;";
  const path = document.createElementNS(ns, "path");
  path.setAttribute("fill", "#62efac");
  path.setAttribute("fill-opacity", "0.88");
  path.setAttribute("stroke", "#102b20");
  path.setAttribute("stroke-width", "0.035");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  document.documentElement.append(svg);
  let latest = "",
    suggestion = null,
    arrowBoard = null;
  let autoplay = false,
    side = "w",
    mode = "auto",
    source = "",
    repeat = true,
    moving = false,
    lastPlayed = "",
    best = null,
    autoBoard = null,
    serial = 0;
  let settings = { onlyWins: true, pauseSeconds: 2, maxGames: 0 },
    stats = { games: 0, wins: 0, losses: 0, draws: 0 },
    notBefore = 0,
    finishBusy = false,
    terminalWinner = "",
    resultWaitStarted = 0;
  let waiting = false,
    terminalFen = "",
    finishedFen = "",
    finishedBoard = null,
    nextBusy = false,
    roundBusy = false,
    deadline = 0,
    nextWasClicked = false;
  function panel(data) {
    if (!panelReady) {
      pendingPanel.set(data.type, data);
      return;
    }
    frame.contentWindow?.postMessage(data, origin);
  }
  function state(message = "") {
    panel({
      type: "autoplay-state",
      active: autoplay,
      side,
      mode,
      source,
      repeat,
      settings,
      stats,
      message,
    });
  }
  function stopAuto(message = "Autoplay stopped", disarm = false) {
    if (
      ["Game limit reached.", "No confirmed win. Autoplay stopped."].includes(
        message,
      )
    )
      disarm = true;
    if (disarm) panel({ type: "autoplay-disarm" });
    autoplay = false;
    waiting = false;
    autoBoard = null;
    serial++;
    state(message);
    chrome.runtime.sendMessage({ type: "autoplay-stop" }).catch(() => {});
  }
  function chooseColor(el) {
    const detected =
      mode === "auto"
        ? ChessRoundUI.detectColor(el, flipped(el, el.getBoundingClientRect()))
        : { side: mode, source: "Manual" };
    side = detected.side;
    source = detected.source;
  }
  function gameEnded() {
    return !!(latest && terminalFen === latest) || ChessRoundUI.gameOver();
  }
  async function startAuto(color, again, options, automatic = false) {
    if (automatic && !/^\/(?:play(?:\/|$)|game\/)/.test(location.pathname)) {
      state("Autostart is waiting for a game page.");
      return;
    }
    if (autoplay) return;
    const version = ++serial;
    document.dispatchEvent(new CustomEvent("local-chess-refresh"));
    const el = board();
    if (!latest || !el || document.visibilityState !== "visible") {
      state("No current visible board detected.");
      return;
    }
    mode = color;
    repeat = !!again;
    settings = options || settings;
    stats = { games: 0, wins: 0, losses: 0, draws: 0 };
    chooseColor(el);
    const result = await chrome.runtime
      .sendMessage({ type: "autoplay-start", side, mode, repeat, settings })
      .catch((error) => ({ ok: false, message: error.message }));
    if (version !== serial) return;
    if (!result?.ok) {
      state(result?.message || "Autoplay could not start.");
      return;
    }
    if (!latest || board() !== el || document.visibilityState !== "visible") {
      stopAuto("The board is no longer ready.");
      return;
    }
    autoplay = true;
    waiting = false;
    resultWaitStarted = 0;
    autoBoard = el;
    lastPlayed = "";
    state("Active · " + (side === "w" ? "White" : "Black"));
    void maintain();
    void playBest();
  }
  async function resumeAuto() {
    const saved = await chrome.runtime
      .sendMessage({ type: "autoplay-status" })
      .catch(() => null);
    if (!saved?.active || saved.phase !== "waiting") return;
    mode = saved.mode || "auto";
    repeat = saved.repeat;
    side = saved.side;
    settings = saved.options || settings;
    stats = saved.stats || stats;
    notBefore = saved.notBefore || 0;
    waiting = true;
    autoplay = true;
    nextWasClicked = saved.actions > 0;
    finishedFen = saved.finishedFen;
    deadline = saved.deadline;
    serial++;
    state("Waiting for the next game …");
  }
  async function playBest() {
    if (
      !autoplay ||
      waiting ||
      gameEnded() ||
      moving ||
      !best ||
      best.fen !== latest ||
      latest.split(" ")[1] !== side ||
      lastPlayed === latest
    )
      return;
    moving = true;
    lastPlayed = latest;
    const version = serial;
    const result = await chrome.runtime
      .sendMessage({ type: "autoplay-move", fen: best.fen, uci: best.uci })
      .catch((error) => ({ ok: false, message: error.message }));
    moving = false;
    if (version !== serial) return;
    if (!result?.ok)
      stopAuto(result?.message || "The move could not be played.");
    else {
      state(
        "Active · " +
          (side === "w" ? "White" : "Black") +
          " · Waiting for our turn",
      );
      void maintain();
      void playBest();
    }
  }
  function newRoundReady() {
    if (
      !waiting ||
      !latest ||
      (latest === finishedFen && !nextWasClicked) ||
      latest === terminalFen ||
      ChessRoundUI.gameOver() ||
      ChessRoundUI.inSetup() ||
      !board()
    )
      return false;
    const fullmove = Number(latest.split(" ")[5]);
    return fullmove <= 2 || (finishedBoard && board() !== finishedBoard);
  }
  async function maintain() {
    if (!autoplay || moving || nextBusy || roundBusy || finishBusy) return;
    if (!waiting && gameEnded()) {
      finishBusy = true;
      const version = serial;
      const outcome =
        terminalFen === latest && terminalWinner
          ? terminalWinner === "draw"
            ? "draw"
            : terminalWinner === side
              ? "win"
              : "loss"
          : ChessRoundUI.outcome(side);
      if (outcome === "unknown" && settings.onlyWins) {
        if (!resultWaitStarted) resultWaitStarted = Date.now();
        if (Date.now() - resultWaitStarted < 3000) {
          finishBusy = false;
          state("Game finished · Reading the result …");
          return;
        }
      }
      const finished = await chrome.runtime
        .sendMessage({ type: "autoplay-finish", fen: latest, outcome })
        .catch(() => null);
      finishBusy = false;
      if (version !== serial) return;
      if (finished?.stats) stats = finished.stats;
      if (!finished?.continue) {
        stopAuto(finished?.message || "Game finished.");
        return;
      }
      notBefore = finished.notBefore || 0;
      waiting = true;
      nextWasClicked = false;
      finishedFen = latest;
      finishedBoard = autoBoard;
      deadline = notBefore + 90000;
      hideArrow();
      best = null;
      state("Game finished · Starting the next game …");
    }
    if (waiting) {
      if (Date.now() < notBefore) {
        state(
          "Win · Next 5+0 game in " +
            Math.ceil((notBefore - Date.now()) / 1000) +
            " s",
        );
        return;
      }
      if (Date.now() > deadline) {
        stopAuto("New game not detected. Check the game page.");
        return;
      }
      const version = serial;
      if (newRoundReady()) {
        roundBusy = true;
        const result = await chrome.runtime
          .sendMessage({ type: "autoplay-round" })
          .catch(() => null);
        roundBusy = false;
        if (version !== serial) return;
        if (result?.ok) {
          waiting = false;
          terminalFen = "";
          terminalWinner = "";
          resultWaitStarted = 0;
          finishedFen = "";
          autoBoard = board();
          lastPlayed = "";
          chooseColor(autoBoard);
          best = null;
          panel({ type: "chess-new-round", fen: latest });
          state("New game · " + (side === "w" ? "White" : "Black"));
          return;
        }
      }
      nextBusy = true;
      const result = await chrome.runtime
        .sendMessage({ type: "autoplay-next", fen: finishedFen })
        .catch((error) => ({ ok: false, message: error.message }));
      nextBusy = false;
      if (version !== serial) return;
      if (!result?.ok)
        stopAuto(result?.message || "The next game could not be started.");
      else {
        if (result.deadline) deadline = result.deadline;
        if (result.actions > 0) nextWasClicked = true;
      }
      return;
    }
    if (board() !== autoBoard) stopAuto("Board changed. Autoplay stopped.");
  }
  function point(el, square) {
    const r = el.getBoundingClientRect(),
      reverse = flipped(el, r);
    const file = square.charCodeAt(0) - 97 + 0.5,
      rank = 8 - Number(square[1]) + 0.5;
    return {
      x: r.left + ((reverse ? 8 - file : file) * r.width) / 8,
      y: r.top + ((reverse ? 8 - rank : rank) * r.height) / 8,
    };
  }
  function avoidFrame(p) {
    frame.style.height = "52px";
    frame.style.top = p.y > innerHeight / 2 ? "8px" : "auto";
    frame.style.bottom = p.y > innerHeight / 2 ? "auto" : "8px";
    panel({ type: "chess-collapse" });
  }
  function uncovered(el, p) {
    let hit = document.elementFromPoint(p.x, p.y);
    if (hit === frame) {
      avoidFrame(p);
      hit = document.elementFromPoint(p.x, p.y);
    }
    return hit && (hit === el || el.contains(hit));
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === "autoplay-state" && !message.active) {
      autoplay = false;
      waiting = false;
      autoBoard = null;
      serial++;
      state(message.message);
      return;
    }
    if (message?.type === "autoplay-prepare-next") {
      if (!autoplay || !repeat || !waiting || document.hidden) {
        respond({ ok: false, message: "Continue playing stopped." });
        return;
      }
      respond({
        ok: true,
        action: ChessRoundUI.nextAction(message.stage, avoidFrame),
      });
      return;
    }
    if (message?.type === "autoplay-prepare-round") {
      document.dispatchEvent(new CustomEvent("local-chess-refresh"));
      if (!autoplay || !newRoundReady() || document.hidden) {
        respond({ ok: false });
        return;
      }
      chooseColor(board());
      respond({ ok: true, side, fen: latest });
      return;
    }
    if (message?.type !== "autoplay-prepare") return;
    document.dispatchEvent(new CustomEvent("local-chess-refresh"));
    const el = board();
    if (
      !autoplay ||
      waiting ||
      !el ||
      el !== autoBoard ||
      !latest ||
      document.visibilityState !== "visible"
    ) {
      respond({
        ok: false,
        message: "Autoplay stopped or the board is not visible.",
      });
      return;
    }
    const { fen, uci, promotion } = message;
    if (promotion && latest !== fen) {
      respond({ ok: true, moved: true, fen: latest, ended: gameEnded() });
      return;
    }
    if (gameEnded()) {
      respond({ ok: false, message: "Game finished." });
      return;
    }
    if (
      latest !== fen ||
      typeof uci !== "string" ||
      !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)
    ) {
      respond({ ok: false, message: "The position changed." });
      return;
    }
    if (promotion) {
      const piece = side + uci[4];
      const entry = [
        ...el.querySelectorAll(
          ".promotion-window ." + piece + ", .promotion-piece." + piece,
        ),
      ].find((node) => node.getBoundingClientRect().width > 0);
      if (!entry) {
        respond({ ok: true });
        return;
      }
      const r = entry.getBoundingClientRect(),
        p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      respond(
        uncovered(el, p)
          ? { ok: true, promotion: p }
          : { ok: false, message: "The promotion menu is covered." },
      );
      return;
    }
    const from = point(el, uci.slice(0, 2)),
      to = point(el, uci.slice(2, 4));
    if (!uncovered(el, from) || !uncovered(el, to)) {
      respond({
        ok: false,
        message:
          "The board is covered. Minimize the overlay or enlarge the window.",
      });
      return;
    }
    respond({ ok: true, from, to });
  });
  document.addEventListener("visibilitychange", () => {
    if (autoplay && document.hidden && !waiting)
      stopAuto("Tab left. Autoplay stopped.");
  });
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") stopAuto(undefined, true);
    },
    true,
  );
  window.addEventListener("pagehide", () => {
    if (autoplay && !waiting) stopAuto();
  });
  function hideArrow() {
    suggestion = null;
    arrowBoard = null;
    svg.style.display = "none";
  }
  function board() {
    return [...document.querySelectorAll("wc-chess-board, chess-board, .board")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 80 && r.height > 80 && el.getClientRects().length;
      })
      .sort(
        (a, b) =>
          b.getBoundingClientRect().width - a.getBoundingClientRect().width,
      )[0];
  }
  function flipped(el, rect) {
    // A visible piece anchors orientation even when the site's flip class changes.
    for (const piece of el.querySelectorAll(".piece")) {
      const square = [...piece.classList]
        .map((c) => /^square-([1-8])([1-8])$/.exec(c))
        .find(Boolean);
      if (!square) continue;
      const r = piece.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const x = ((r.left + r.width / 2 - rect.left) / rect.width) * 8;
      const file = Number(square[1]) - 0.5;
      const normal = Math.abs(x - file),
        reverse = Math.abs(x - (8 - file));
      if (Math.min(normal, reverse) < 0.3) return reverse < normal;
    }
    return !!el.closest(
      '.flipped, [data-flipped="true"], [orientation="black"]',
    );
  }
  function draw() {
    if (!suggestion) return;
    const el = board();
    if (!el || el !== arrowBoard) {
      hideArrow();
      return;
    }
    const r = el.getBoundingClientRect(),
      reverse = flipped(el, r);
    function point(s) {
      const x = s.charCodeAt(0) - 97 + 0.5,
        y = 8 - Number(s[1]) + 0.5;
      return reverse ? [8 - x, 8 - y] : [x, y];
    }
    const [x1, y1] = point(suggestion.from),
      [x2, y2] = point(suggestion.to);
    const dx = x2 - x1,
      dy = y2 - y1,
      len = Math.hypot(dx, dy);
    const ux = dx / len,
      uy = dy / len,
      px = -uy,
      py = ux;
    const neckX = x2 - ux * 0.46,
      neckY = y2 - uy * 0.46;
    const points = [
      [x1 + px * 0.105, y1 + py * 0.105],
      [neckX + px * 0.105, neckY + py * 0.105],
      [neckX + px * 0.3, neckY + py * 0.3],
      [x2, y2],
      [neckX - px * 0.3, neckY - py * 0.3],
      [neckX - px * 0.105, neckY - py * 0.105],
      [x1 - px * 0.105, y1 - py * 0.105],
    ];
    path.setAttribute(
      "d",
      points.map(([x, y], i) => (i ? "L" : "M") + x + "," + y).join(" ") + " Z",
    );
    Object.assign(svg.style, {
      left: r.left + "px",
      top: r.top + "px",
      width: r.width + "px",
      height: r.height + "px",
      display: "block",
    });
  }
  function send() {
    if (latest) panel({ type: "chess-fen", fen: latest });
  }
  document.addEventListener("local-chess-fen", (e) => {
    if (typeof e.detail !== "string" || e.detail.length > 150) return;
    if (e.detail !== latest) {
      hideArrow();
      best = null;
    }
    latest = e.detail;
    if (latest && !autoplay && mode === "auto" && board()) {
      chooseColor(board());
      state();
    }
    if (!latest && autoplay && !waiting)
      stopAuto("The board is no longer detected.");
    send();
  });
  frame.addEventListener("load", () => {
    panelReady = false;
  });
  window.addEventListener("message", (e) => {
    if (!e.isTrusted || e.source !== frame.contentWindow || e.origin !== origin)
      return;
    if (e.data?.type === "chess-panel-unloading") {
      panelReady = false;
      return;
    }
    if (e.data?.type === "chess-ready") {
      panelReady = true;
      for (const data of pendingPanel.values()) {
        if (!data.fen || data.fen === latest) panel(data);
      }
      pendingPanel.clear();
      send();
      state();
    }
    if (
      e.data?.type === "autoplay-start" &&
      ["auto", "w", "b"].includes(e.data.side)
    )
      void startAuto(
        e.data.side,
        e.data.repeat,
        e.data.settings,
        e.data.automatic,
      );
    if (e.data?.type === "chess-gameover" && e.data.fen === latest) {
      terminalFen = latest;
      terminalWinner = e.data.winner || "";
      void maintain();
    }
    if (e.data?.type === "autoplay-stop") stopAuto(undefined, true);
    if (e.data?.type === "chess-minimize")
      frame.style.height = e.data.small ? "52px" : "590px";
    if (e.data?.type === "chess-clear-arrow") hideArrow();
    if (e.data?.type === "chess-bestmove") {
      const { fen, uci } = e.data;
      if (
        fen !== latest ||
        typeof uci !== "string" ||
        !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci) ||
        uci.slice(0, 2) === uci.slice(2, 4)
      )
        return;
      suggestion = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
      arrowBoard = board();
      draw();
      best = { fen, uci };
      void playBest();
    }
  });
  window.addEventListener("resize", draw);
  window.addEventListener("scroll", draw, true);
  setInterval(() => {
    draw();
    void maintain();
  }, 250);
  void resumeAuto();
})();
