import { Chess } from "./vendor/chess.js";

const sessions = new Map();
const allowed = (url) => /^https:\/\/(www\.)?chess\.com\//.test(url || "");
const target = (tabId) => ({ tabId });
function notify(tabId, active, message = "") {
  return chrome.tabs
    .sendMessage(tabId, { type: "autoplay-state", active, message })
    .catch(() => {});
}
async function stop(tabId, message = "Autoplay stopped") {
  const session = sessions.get(tabId);
  sessions.delete(tabId);
  if (session) {
    try {
      await chrome.debugger.detach(target(tabId));
    } catch {}
  }
  await notify(tabId, false, message);
}
function stillActive(tabId, session) {
  if (sessions.get(tabId) !== session) throw new Error("Autoplay stopped");
}
async function start(tabId, side, mode = side, repeat = false, settings = {}) {
  if (!["w", "b"].includes(side)) throw new Error("Select White or Black.");
  if (sessions.has(tabId))
    throw new Error("Autoplay is already running. Stop it first.");
  const options = {
    onlyWins: settings.onlyWins !== false,
    pauseSeconds: Math.max(
      0,
      Math.min(60, Math.floor(Number(settings.pauseSeconds) || 0)),
    ),
    maxGames: Math.max(
      0,
      Math.min(1000, Math.floor(Number(settings.maxGames) || 0)),
    ),
  };
  const session = {
    options,
    stats: { games: 0, wins: 0, losses: 0, draws: 0 },
    finishedResult: null,
    timeConfirmed: false,
    side,
    mode,
    repeat: !!repeat,
    phase: "playing",
    ready: false,
    working: false,
    lastFen: "",
    actions: new Set(),
  };
  sessions.set(tabId, session);
  try {
    await chrome.debugger.attach(target(tabId), "1.3");
    stillActive(tabId, session);
    session.ready = true;
    return { ok: true };
  } catch (error) {
    if (sessions.get(tabId) === session) await stop(tabId);
    else if (!sessions.has(tabId)) {
      try {
        await chrome.debugger.detach(target(tabId));
      } catch {}
    }
    throw error;
  }
}
async function prepare(tabId, session, fen, uci, promotion = false) {
  stillActive(tabId, session);
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active || !allowed(tab.url))
    throw new Error("chess.com must be the active tab.");
  const result = await chrome.tabs.sendMessage(tabId, {
    type: "autoplay-prepare",
    fen,
    uci,
    promotion,
  });
  stillActive(tabId, session);
  if (!result?.ok)
    throw new Error(result?.message || "The position or board changed.");
  return result;
}
async function click(tabId, session, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new Error("Invalid target square.");
  for (const [type, buttons] of [
    ["mouseMoved", 0],
    ["mousePressed", 1],
    ["mouseReleased", 0],
  ]) {
    stillActive(tabId, session);
    await chrome.debugger.sendCommand(
      target(tabId),
      "Input.dispatchMouseEvent",
      {
        type,
        x: point.x,
        y: point.y,
        button: type === "mouseMoved" ? "none" : "left",
        buttons,
        clickCount: type === "mouseMoved" ? 0 : 1,
      },
    );
  }
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function play(tabId, fen, uci) {
  const session = sessions.get(tabId);
  if (!session?.ready || session.working)
    throw new Error("Autoplay is not ready.");
  if (
    typeof fen !== "string" ||
    fen.length > 150 ||
    typeof uci !== "string" ||
    !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)
  )
    throw new Error("Invalid move.");
  const game = new Chess(fen);
  if (game.turn() !== session.side || session.lastFen === fen)
    throw new Error("This position is not eligible for autoplay.");
  game.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4] || "q",
  });
  const expected = game.fen().split(" ").slice(0, 4).join(" ");
  function verify(result) {
    if (result.ended && session.repeat) return;
    if (
      new Chess(result.fen).fen().split(" ").slice(0, 4).join(" ") !== expected
    )
      throw new Error(
        "The board reached a different position. Autoplay stopped.",
      );
  }
  session.working = true;
  session.lastFen = fen;
  try {
    let info = await prepare(tabId, session, fen, uci);
    await click(tabId, session, info.from);
    await delay(90);
    info = await prepare(tabId, session, fen, uci);
    await click(tabId, session, info.to);
    if (uci.length === 5) {
      // Auto-queen may have completed the move already. Otherwise choose the actual menu entry.
      for (let i = 0; i < 12; i++) {
        await delay(100);
        info = await prepare(tabId, session, fen, uci, true);
        if (info.moved) {
          verify(info);
          break;
        }
        if (info.promotion) {
          await click(tabId, session, info.promotion);
          break;
        }
      }
    }
    let confirmed = false;
    for (let i = 0; i < 20; i++) {
      await delay(100);
      const state = await prepare(tabId, session, fen, uci, true);
      if (state.moved) {
        verify(state);
        confirmed = true;
        break;
      }
    }
    if (!confirmed)
      throw new Error(
        "The move was not accepted. Autoplay stopped; check the board.",
      );
    return { ok: true };
  } catch (error) {
    if (session.repeat && error.message === "Game finished.")
      return { ok: true, ended: true };
    if (sessions.get(tabId) === session) await stop(tabId, error.message);
    throw error;
  } finally {
    session.working = false;
  }
}
async function finishRound(tabId, fen, outcome) {
  const session = sessions.get(tabId);
  if (!session?.ready) throw new Error("Autoplay is off.");
  if (session.finishedResult) return session.finishedResult;
  session.stats.games++;
  if (outcome === "win") session.stats.wins++;
  if (outcome === "loss") session.stats.losses++;
  if (outcome === "draw") session.stats.draws++;
  const proceed =
    session.repeat &&
    (!session.options.onlyWins || outcome === "win") &&
    (!session.options.maxGames ||
      session.stats.games < session.options.maxGames);
  const message =
    session.options.maxGames && session.stats.games >= session.options.maxGames
      ? "Game limit reached."
      : session.options.onlyWins && outcome !== "win"
        ? "No confirmed win. Autoplay stopped."
        : "Game finished.";
  session.finishedResult = {
    ok: true,
    continue: proceed,
    stats: session.stats,
    message,
    notBefore: Date.now() + session.options.pauseSeconds * 1000,
  };
  if (proceed) {
    session.phase = "waiting";
    session.finishedFen = fen;
    session.timeConfirmed = false;
    session.notBefore = session.finishedResult.notBefore;
    session.deadline = session.notBefore + 90000;
    session.actions.clear();
    session.waitStart = session.notBefore;
  }
  return session.finishedResult;
}
async function nextRound(tabId, finishedFen) {
  const session = sessions.get(tabId);
  if (!session?.ready || !session.repeat)
    throw new Error("Continue playing is disabled.");
  if (session.working) return { ok: true, pending: true };
  if (!session.finishedResult?.continue)
    throw new Error("Starting the next game is not enabled.");
  if (Date.now() < session.notBefore) return { ok: true, pending: true };
  if (session.phase !== "waiting") {
    session.phase = "waiting";
    session.finishedFen = finishedFen;
    session.deadline = Date.now() + 90000;
    session.actions.clear();
    session.waitStart = Date.now();
  }
  session.working = true;
  try {
    stillActive(tabId, session);
    if (Date.now() > session.deadline)
      throw new Error("No new game found. Check the game page.");
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active || !allowed(tab.url))
      throw new Error("chess.com must be the active tab.");
    const action = await chrome.tabs.sendMessage(tabId, {
      type: "autoplay-prepare-next",
      finishedFen: session.finishedFen,
      stage: session.actions.size,
    });
    stillActive(tabId, session);
    if (!action?.ok)
      throw new Error(action?.message || "The game result is not confirmed.");
    if (action.action && !session.actions.has(action.action.key)) {
      if (session.actions.size >= 6)
        throw new Error(
          "The next game needs additional input. Autoplay stopped.",
        );
      session.actions.add(action.action.key);
      session.lastActionAt = Date.now();
      if (action.action.kind === "navigate") {
        await chrome.tabs.update(tabId, {
          url: new URL(tab.url).origin + "/play/online",
        });
      } else {
        if (["direct5", "play5"].includes(action.action.kind))
          session.timeConfirmed = true;
        await click(tabId, session, action.action.point);
      }
    } else if (
      !session.timeConfirmed &&
      Date.now() - (session.lastActionAt || session.waitStart) > 15000
    ) {
      throw new Error("Could not confirm 5+0 blitz. Check the game setup.");
    }
    return {
      ok: true,
      pending: true,
      deadline: session.deadline,
      actions: session.actions.size,
    };
  } catch (error) {
    if (sessions.get(tabId) === session) await stop(tabId, error.message);
    throw error;
  } finally {
    session.working = false;
  }
}
async function newRound(tabId) {
  const session = sessions.get(tabId);
  if (!session?.timeConfirmed)
    return { ok: false, message: "5+0 blitz is not confirmed yet." };
  if (!session?.ready || session.phase !== "waiting" || session.working)
    return { ok: false, message: "The next game is not ready yet." };
  const info = await chrome.tabs.sendMessage(tabId, {
    type: "autoplay-prepare-round",
  });
  stillActive(tabId, session);
  if (!info?.ok || !["w", "b"].includes(info.side))
    return { ok: false, message: "The next game has not been detected yet." };
  const game = new Chess(info.fen);
  if (game.isGameOver())
    return { ok: false, message: "The next game has not been detected yet." };
  session.side = info.side;
  session.phase = "playing";
  session.lastFen = "";
  session.actions.clear();
  session.finishedFen = "";
  session.finishedResult = null;
  session.lastActionAt = 0;
  return { ok: true, side: session.side };
}
function status(tabId) {
  const s = sessions.get(tabId);
  if (!s?.ready) return { ok: true, active: false };
  return {
    ok: true,
    active: true,
    side: s.side,
    mode: s.mode,
    repeat: s.repeat,
    phase: s.phase,
    finishedFen: s.finishedFen,
    deadline: s.deadline,
    actions: s.actions.size,
    options: s.options,
    stats: s.stats,
    notBefore: s.notBefore,
  };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    !sender.tab ||
    sender.frameId !== 0 ||
    !allowed(sender.url || sender.tab.url)
  )
    return;
  const tabId = sender.tab.id;
  let task;
  if (message?.type === "autoplay-start")
    task = start(
      tabId,
      message.side,
      message.mode,
      message.repeat,
      message.settings,
    );
  if (message?.type === "autoplay-stop")
    task = stop(tabId).then(() => ({ ok: true }));
  if (message?.type === "autoplay-status")
    task = Promise.resolve(status(tabId));
  if (message?.type === "autoplay-finish")
    task = finishRound(tabId, message.fen, message.outcome);
  if (message?.type === "autoplay-next") task = nextRound(tabId, message.fen);
  if (message?.type === "autoplay-round") task = newRound(tabId);
  if (message?.type === "autoplay-move")
    task = play(tabId, message.fen, message.uci);
  if (!task) return;
  task.then(respond, (error) =>
    respond({ ok: false, message: error.message || "Autoplay failed." }),
  );
  return true;
});
chrome.debugger.onDetach.addListener(({ tabId }) => {
  if (sessions.has(tabId)) {
    sessions.delete(tabId);
    void notify(
      tabId,
      false,
      "Browser control disconnected. Autoplay stopped.",
    );
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  sessions.delete(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  const s = sessions.get(tabId);
  if (
    change.status === "loading" &&
    s &&
    !(s.phase === "waiting" && Date.now() < s.deadline)
  )
    void stop(tabId, "Page reloaded. Autoplay stopped.");
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  for (const id of sessions.keys())
    if (id !== tabId) void stop(id, "Tab left. Autoplay stopped.");
});
