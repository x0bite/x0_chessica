(() => {
  let last = "";
  function read(force = false) {
    try {
      const board = [
        ...document.querySelectorAll("wc-chess-board, chess-board, .board"),
      ]
        .filter(
          (el) =>
            el.getBoundingClientRect().width > 80 && el.getClientRects().length,
        )
        .sort(
          (a, b) =>
            b.getBoundingClientRect().width - a.getBoundingClientRect().width,
        )[0];
      const fen = board?.game?.getFEN?.();
      const value = typeof fen === "string" ? fen : "";
      let own = "";
      try {
        const playing = board?.game?.getPlayingAs?.();
        own = { white: "w", black: "b", w: "w", b: "b" }[playing] || "";
      } catch {}
      document.dispatchEvent(
        new CustomEvent("local-chess-side", { detail: own }),
      );
      if (force || value !== last) {
        last = value;
        document.dispatchEvent(
          new CustomEvent("local-chess-fen", { detail: value }),
        );
      }
    } catch {
      if (force || last) {
        last = "";
        document.dispatchEvent(
          new CustomEvent("local-chess-fen", { detail: "" }),
        );
      }
    }
  }
  document.addEventListener("local-chess-refresh", () => read(true));
  setInterval(read, 400);
})();
