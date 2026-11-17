(() => {
  const normalize = (value) =>
    ({ w: "w", white: "w", weiß: "w", b: "b", black: "b", schwarz: "b" })[
      String(value || "").toLowerCase()
    ];
  const setupSelectors =
    '.new-game-component,.new-game-layout,.new-game-buttons-component,[data-cy="new-game-form"]';
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return !!(
      r.width &&
      r.height &&
      el.getClientRects().length &&
      getComputedStyle(el).visibility !== "hidden"
    );
  };
  const endSelectors =
    '.game-over-modal-component,.game-over-modal,.game-over-dialog,.game-over-dialog-component,.game-over-header-component,[data-cy="game-over-header"],[data-cy="game-over-modal"],[data-cy="game-over-dialog"],[data-game-over="true"]';
  let nativeSide = "";
  document.addEventListener("local-chess-side", (e) => {
    nativeSide = normalize(e.detail) || "";
  });
  function detectColor(board, isFlipped) {
    if (nativeSide) return { side: nativeSide, source: "Player identity" };
    const explicit = normalize(board.dataset.playerColor);
    if (explicit) return { side: explicit, source: "Player identity" };
    const self = document.querySelector(
      '.player-component[data-is-self="true"],.player-component[data-is-me="true"]',
    );
    const direct = normalize(self?.dataset.color);
    if (direct) return { side: direct, source: "Player identity" };
    const profile = document.querySelector(
      '[data-cy="nav-profile"][href*="/member/"],[data-cy="nav-profile"] a[href*="/member/"],.nav-menu-component a[href*="/member/"]',
    );
    const username = profile
      ?.getAttribute("href")
      ?.split("/member/")[1]
      ?.split(/[/?#]/)[0]
      ?.toLowerCase();
    const player =
      self ||
      (username &&
        [...document.querySelectorAll(".player-component")].find((el) =>
          [...el.querySelectorAll('a[href*="/member/"]')].some(
            (a) =>
              a
                .getAttribute("href")
                .split("/member/")[1]
                ?.split(/[/?#]/)[0]
                ?.toLowerCase() === username,
          ),
        ));
    if (player && visible(player)) {
      const r = board.getBoundingClientRect(),
        p = player.getBoundingClientRect();
      const bottom = p.top + p.height / 2 > r.top + r.height / 2;
      return {
        side: bottom ? (isFlipped ? "b" : "w") : isFlipped ? "w" : "b",
        source: "Player position",
      };
    }
    return { side: isFlipped ? "b" : "w", source: "Board orientation" };
  }
  function gameOver() {
    return [...document.querySelectorAll(endSelectors)].some(visible);
  }
  function label(el) {
    return (
      el.getAttribute("aria-label") ||
      el.innerText ||
      el.textContent ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");
  }
  function isFive(value) {
    const text = String(value || "")
      .toLowerCase()
      .trim()
      .replace(/^(?:new|neue partie|neues spiel|neue|neues|neu)\s+/, "")
      .replace(/\s+blitz$/, "");
    return /^(?:5\s*(?:min\.?|minutes?|minuten)?|5\s*[+|]\s*0)$/.test(text);
  }
  function outcome(side) {
    for (const el of document.querySelectorAll(endSelectors)) {
      if (!visible(el)) continue;
      const winner = normalize(el.dataset.winner);
      if (winner) return winner === side ? "win" : "loss";
      const text = (el.innerText || "").toLowerCase();
      if (/\b(draw|remis|unentschieden|stalemate|patt)\b/.test(text))
        return "draw";
      if (/you (?:have )?won|du hast gewonnen|du gewinnst|sieg!/.test(text))
        return "win";
      if (/you (?:have )?lost|du hast verloren|niederlage/.test(text))
        return "loss";
      if (/white (?:has )?won|weiß (?:hat gewonnen|gewinnt)/.test(text))
        return side === "w" ? "win" : "loss";
      if (/black (?:has )?won|schwarz (?:hat gewonnen|gewinnt)/.test(text))
        return side === "b" ? "win" : "loss";
    }
    return "unknown";
  }
  function fiveSelected() {
    return [
      ...document.querySelectorAll(
        '[data-cy="time-control"],[data-cy="time-control-button"],.time-selector-button-component,.time-selector-button-button,[data-time-control],.time-selector-component [aria-selected="true"],[data-cy="time-selector"] [aria-selected="true"],.time-selector-component input[type="radio"]:checked',
      ),
    ].some(
      (el) =>
        visible(el) &&
        (isFive(el.dataset.timeControl) ||
          isFive(el.value) ||
          isFive(label(el))),
    );
  }
  function nextAction(stage, avoidOverlay) {
    const controls = [
      ...document.querySelectorAll(
        'button,[role="button"],a,[role="option"],label',
      ),
    ].filter(
      (el) =>
        visible(el) &&
        !el.disabled &&
        el.getAttribute("aria-disabled") !== "true",
    );
    function action(el, kind) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      const r = el.getBoundingClientRect(),
        point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      let hit = document.elementFromPoint(point.x, point.y);
      if (hit?.id === "local-chess-overlay" && avoidOverlay) {
        avoidOverlay(point);
        hit = document.elementFromPoint(point.x, point.y);
      }
      if (hit !== el && !el.contains(hit)) return null;
      return {
        point,
        kind,
        key: location.href + "|" + kind + "|" + label(el).toLowerCase(),
      };
    }
    // An explicit New 5 min action is already an exact time-control selection.
    for (const el of controls)
      if (/^(new|neue|neues|neu)\s/i.test(label(el)) && isFive(label(el))) {
        const a = action(el, "direct5");
        if (a) return a;
      }
    const setup = inSetup() || /^\/play\/online\/?$/.test(location.pathname);
    if (!setup)
      return {
        kind: "navigate",
        url: location.origin + "/play/online",
        key: "setup-5+0",
      };
    if (!fiveSelected()) {
      for (const el of controls)
        if (isFive(label(el))) {
          const a = action(el, "time5");
          if (a) return a;
        }
      for (const el of document.querySelectorAll(
        '[data-cy="time-control"],[data-cy="time-control-button"],.time-selector-button-component,.time-selector-button-button',
      )) {
        if (visible(el)) {
          const a = action(el, "time-menu");
          if (a) return a;
        }
      }
      return null;
    }
    for (const el of controls)
      if (
        /^(play|spielen|start game|partie starten)$/i.test(label(el)) &&
        (el.closest(setupSelectors + ', [data-cy="play-button"]') ||
          location.pathname === "/play/online")
      ) {
        const a = action(el, "play5");
        if (a) return a;
      }
    return null;
  }
  function inSetup() {
    return [...document.querySelectorAll(setupSelectors)].some(visible);
  }
  globalThis.ChessRoundUI = {
    detectColor,
    gameOver,
    nextAction,
    inSetup,
    outcome,
    isFive,
  };
})();
