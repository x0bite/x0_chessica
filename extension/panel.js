import { Chess } from "./vendor/chess.js";
import { parseVariation, pickVariation } from "./variation.js";
const $ = (id) => document.getElementById(id);
let ready = false,
  busy = false,
  pending = "",
  current = "",
  active = "",
  small = false,
  playing = false,
  starting = false;
let variations = new Map(),
  activeVariation = true,
  autostartAttempted = false,
  autostartTimer,
  preferencesLoaded = false;
const engine = new Worker("./vendor/stockfish-19-lite-single.js");
function clear() {
  parent.postMessage({ type: "chess-clear-arrow" }, "*");
  $("move").textContent = "—";
  $("score").textContent = "";
  $("detail").textContent = "Calculating …";
}
function start() {
  if (!ready || busy || !pending) return;
  active = pending;
  pending = "";
  busy = true;
  clear();
  variations = new Map();
  activeVariation = $("variation").checked;
  engine.postMessage(
    "setoption name MultiPV value " + (activeVariation ? 3 : 1),
  );
  engine.postMessage("position fen " + active);
  engine.postMessage("go movetime " + $("time").value);
}
function analyze(fen) {
  try {
    const c = new Chess(fen);
    current = fen.trim();
    $("error").textContent = "";
    if (c.isGameOver())
      parent.postMessage(
        {
          type: "chess-gameover",
          fen: current,
          winner: c.isCheckmate() ? (c.turn() === "w" ? "b" : "w") : "draw",
        },
        "*",
      );
  } catch {
    $("error").textContent = "Invalid FEN. Check the complete position.";
    return;
  }
  maybeAutostart();
  pending = current;
  if (busy) {
    clear();
    engine.postMessage("stop");
  } else start();
}
engine.onerror = () => {
  parent.postMessage({ type: "chess-clear-arrow" }, "*");
  $("status").textContent = "The engine could not be loaded";
  $("error").textContent = "Reload the extension and refresh the page.";
};
engine.onmessage = ({ data }) => {
  for (const line of String(data).split("\n")) {
    if (line === "uciok") {
      engine.postMessage("setoption name Hash value 32");
      engine.postMessage("isready");
    }
    if (line === "readyok") {
      ready = true;
      $("status").textContent = "Ready · Waiting for a board / FEN";
      start();
      maybeAutostart();
    }
    if (line.startsWith("info ") && !pending) {
      const entry = parseVariation(line);
      if (entry) variations.set(entry.index, entry);
      if (entry && entry.index !== 1) continue;
      const score = line.match(/score (cp|mate) (-?\d+)/),
        depth = line.match(/depth (\d+)/);
      if (score) {
        const n = Number(score[2]) * (active.split(" ")[1] === "w" ? 1 : -1);
        $("score").textContent =
          (score[1] === "mate"
            ? "Mate " + n
            : (n >= 0 ? "+" : "") + (n / 100).toFixed(2)) +
          (depth ? " · Depth " + depth[1] : "");
      }
    }
    if (line.startsWith("bestmove ")) {
      busy = false;
      if (pending) {
        start();
        continue;
      }
      const choice = pickVariation(
        line.split(" ")[1],
        variations,
        activeVariation,
      );
      const uci = choice.uci;
      if (!uci || uci === "(none)" || uci === "0000") {
        $("move").textContent = "Game finished";
        $("detail").textContent = "No legal move";
        continue;
      }
      try {
        const c = new Chess(active);
        const move = c.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci[4] || "q",
        });
        $("move").textContent = move.san;
        $("detail").textContent =
          move.from +
          " → " +
          move.to +
          (move.promotion
            ? " · Promotion: " + move.promotion.toUpperCase()
            : "");
        $("status").textContent =
          (active.split(" ")[1] === "w" ? "White" : "Black") +
          " to move" +
          (choice.varied ? " · Alternative" : "");
        if (choice.varied) {
          const score = choice.score * (active.split(" ")[1] === "w" ? 1 : -1);
          $("score").textContent =
            (score >= 0 ? "+" : "") +
            (score / 100).toFixed(2) +
            " · Alternative";
        }
        parent.postMessage({ type: "chess-bestmove", fen: active, uci }, "*");
      } catch {
        $("error").textContent = "Could not read the engine result.";
      }
    }
  }
};
engine.postMessage("uci");
window.addEventListener("message", (e) => {
  if (e.source !== parent || !/^https:\/\/(www\.)?chess\.com$/.test(e.origin))
    return;
  if (e.data?.type === "autoplay-disarm") setArmed(false);
  if (e.data?.type === "chess-collapse") {
    small = true;
    $("min").textContent = "+";
  }
  if (e.data?.type === "autoplay-state") {
    playing = !!e.data.active;
    starting = false;
    if (playing) autostartAttempted = true;
    if (
      !playing &&
      ["Game limit reached.", "No confirmed win. Autoplay stopped."].includes(
        e.data.message,
      )
    )
      setArmed(false);
    $("play").disabled = false;
    $("play").textContent = playing ? "Stop" : "Start";
    $("play").classList.toggle("running", playing);
    for (const id of ["side", "repeat", "only-wins", "pause", "limit"])
      $(id).disabled = playing;
    $("quick-stop").hidden = !playing;
    if (playing) {
      $("side").value = e.data.mode || "auto";
      $("repeat").checked = !!e.data.repeat;
    }
    $("detected-color").textContent = e.data.side
      ? (e.data.side === "w" ? "White" : "Black") +
        (e.data.source ? " · " + e.data.source : "")
      : "";
    if (e.data.stats) {
      const s = e.data.stats;
      $("stats").textContent = [
        s.games + " " + (s.games === 1 ? "game" : "games"),
        s.wins + " " + (s.wins === 1 ? "win" : "wins"),
        s.losses + " " + (s.losses === 1 ? "loss" : "losses"),
        s.draws + " " + (s.draws === 1 ? "draw" : "draws"),
      ].join(" · ");
    }
    if (playing && e.data.settings) {
      $("only-wins").checked = e.data.settings.onlyWins;
      $("pause").value = String(e.data.settings.pauseSeconds);
      $("limit").value = String(e.data.settings.maxGames);
    }
    $("play-state").textContent =
      e.data.message || (playing ? "Active" : "Off");
    if (!playing) maybeAutostart();
  }
  if (e.data?.type === "chess-new-round" && typeof e.data.fen === "string")
    analyze(e.data.fen);
  if (
    e.data?.type === "chess-fen" &&
    typeof e.data.fen === "string" &&
    $("auto").checked &&
    e.data.fen !== current
  )
    analyze(e.data.fen);
});
function announceReady() {
  parent.postMessage({ type: "chess-ready" }, "*");
}
if (document.readyState === "complete") announceReady();
else window.addEventListener("load", announceReady, { once: true });
window.addEventListener("pagehide", () =>
  parent.postMessage({ type: "chess-panel-unloading" }, "*"),
);
$("analyze").onclick = () => {
  stopPlaying();
  $("auto").checked = false;
  analyze($("fen").value.trim());
};
$("time").onchange = () => {
  if (current) analyze(current);
};
$("min").onclick = () => {
  small = !small;
  $("min").textContent = small ? "+" : "−";
  parent.postMessage({ type: "chess-minimize", small }, "*");
};

function stopPlaying() {
  setArmed(false);
  parent.postMessage({ type: "autoplay-stop" }, "*");
}
function beginPlaying(automatic = false) {
  autostartAttempted = true;
  starting = true;
  $("play").textContent = "Starting …";
  $("play-state").textContent = "Connecting browser control …";
  $("auto").checked = true;
  parent.postMessage(
    {
      type: "autoplay-start",
      automatic,
      side: $("side").value,
      repeat: $("repeat").checked,
      settings: {
        onlyWins: $("only-wins").checked,
        pauseSeconds: Number($("pause").value),
        maxGames: Number($("limit").value),
      },
    },
    "*",
  );
}
$("play").onclick = () => {
  if (playing || starting) stopPlaying();
  else beginPlaying();
};
function maybeAutostart() {
  clearTimeout(autostartTimer);
  autostartTimer = setTimeout(() => {
    if (
      !preferencesLoaded ||
      !ready ||
      !current ||
      playing ||
      starting ||
      autostartAttempted ||
      !$("autostart").checked ||
      document.hidden
    )
      return;
    beginPlaying(true);
  }, 500);
}
function setArmed(enabled) {
  $("autostart").checked = enabled;
  autostartAttempted = !enabled;
  savePreferences();
  if (enabled) maybeAutostart();
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && $("autostart").checked && !playing && !starting) {
    autostartAttempted = false;
    maybeAutostart();
  }
});
$("autostart").onchange = () => {
  if ($("autostart").checked) setArmed(true);
  else stopPlaying();
};
$("quick-stop").onclick = stopPlaying;
$("auto").onchange = () => {
  if (!$("auto").checked) stopPlaying();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") stopPlaying();
});

$("variation").onchange = () => {
  if (current) analyze(current);
};

const preferenceIds = [
  "autostart",
  "side",
  "repeat",
  "only-wins",
  "pause",
  "limit",
  "time",
  "variation",
];
async function loadPreferences() {
  try {
    let saved = globalThis.chrome?.storage?.local
      ? (await chrome.storage.local.get("overlayPreferences"))
          .overlayPreferences
      : null;
    if (!saved) {
      try {
        saved = JSON.parse(
          localStorage.getItem("chess-overlay-preferences") || "{}",
        );
      } catch {
        saved = {};
      }
    }
    for (const id of preferenceIds) {
      const el = $(id);
      if (
        saved[id] !== undefined &&
        !(
          playing &&
          ["side", "repeat", "only-wins", "pause", "limit"].includes(id)
        )
      ) {
        if (el.type === "checkbox") el.checked = !!saved[id];
        else if ([...el.options].some((o) => o.value === String(saved[id])))
          el.value = String(saved[id]);
      }
    }
  } catch {}
  preferencesLoaded = true;
  savePreferences();
  maybeAutostart();
}
void loadPreferences();
function savePreferences() {
  const prefs = {};
  for (const key of preferenceIds) {
    const el = $(key);
    prefs[key] = el.type === "checkbox" ? el.checked : el.value;
  }
  try {
    if (globalThis.chrome?.storage?.local)
      void chrome.storage.local
        .set({ overlayPreferences: prefs })
        .catch(() => {});
    else
      localStorage.setItem("chess-overlay-preferences", JSON.stringify(prefs));
  } catch {}
}
for (const id of preferenceIds)
  $(id).addEventListener("change", savePreferences);
window.addEventListener("storage", (e) => {
  if (e.key !== "chess-overlay-preferences") return;
  try {
    const enabled = JSON.parse(e.newValue || "{}").autostart;
    if (typeof enabled !== "boolean") return;
    $("autostart").checked = enabled;
    autostartAttempted = !enabled;
    if (enabled) maybeAutostart();
    else if (playing || starting)
      parent.postMessage({ type: "autoplay-stop" }, "*");
  } catch {}
});

if (globalThis.chrome?.storage?.onChanged)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.overlayPreferences) return;
    const enabled = changes.overlayPreferences.newValue?.autostart;
    if (typeof enabled !== "boolean" || enabled === $("autostart").checked)
      return;
    $("autostart").checked = enabled;
    autostartAttempted = !enabled;
    if (enabled) maybeAutostart();
    else if (playing || starting)
      parent.postMessage({ type: "autoplay-stop" }, "*");
  });
