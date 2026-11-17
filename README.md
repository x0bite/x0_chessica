# x0_chessica

A Manifest V3 extension for Chrome and Edge with local Stockfish analysis, move arrows, and configurable browser automation on chess.com. Version **1.6.1** has an English interface, English documentation, and an upload-ready repository layout.

> Engine assistance in games against other people violates chess.com's fair-play rules and can lead to an account ban. Use this project for analysis and permitted training. Neither wins nor undetected use are guaranteed.

## Install

No build, npm installation, API key, or server is needed to use the extension.

1. Download and extract the repository or the installable extension ZIP.
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Click **Load unpacked**.
4. For this repository, select **`extension/`**, which directly contains `manifest.json`. For the installable ZIP, select the extracted **`x0_chessica/`** folder.
5. Open or refresh a chess.com game tab.

To update, replace the files in the existing extension folder, reload the extension on the extensions page, and refresh the chess.com tab. If an old origin-mismatch error is still listed, clear the stored error entry after updating.

**Always on is enabled by default.** Once a visible board on a game page is recognized and Stockfish is ready, autoplay starts without a Start click. Turn off **Always on**, or press **Stop / Esc**, before opening a game if you only want to inspect the interface.

## Features

- Local Stockfish 19 analysis with selectable thinking time: 0.7, 1.5, or 3 seconds.
- Move arrows that follow board orientation, scrolling, and resizing.
- Automatic color detection, with manual White / Black overrides.
- Always-on preference that survives refreshes and browser restarts.
- **Stop / Esc** also saves always-on mode as disabled. The minimized panel retains a Stop button.
- Automatic next-game setup for **5 minutes with no increment (5+0 blitz)** after a confirmed win.
- Optional continuation after other results, breaks between games, and session game limits.
- Session totals for completed games, wins, losses, and draws.
- Saved preferences in extension storage, with migration from earlier local preferences when available.
- Optional, bounded move variation and a manual FEN input.
- An overlay-readiness handshake that buffers early messages instead of sending them to a loading iframe.

The browser must be running and the game tab must be active. A closed browser does not play games. Returning to an active game tab can restart autoplay if always-on mode is still enabled. Ordinary reloads start a new session; expected next-game navigation preserves the current session.

## Controls and behavior

### Color detection

The extension first uses an available player identity from the board, then the player's position, and finally the board orientation. The panel displays the detected color and its source. Color is held constant during a game, so flipping the board does not switch sides mid-game.

If the source is **Board orientation** and you manually flipped the board before starting, the detected side can be wrong. Use the manual color selector in that case.

### Next game and session settings

Defaults are: continue after a confirmed win, a two-second break, and no game limit.

The extension uses an explicitly labeled **New 5 min / 5+0** action when available. Otherwise it opens the online setup page, selects 5 minutes without an increment, and only then clicks Play. It rejects 10-minute and 5+3 actions as substitutes. If it cannot confirm the required selection, it stops rather than starting with an unknown time control.

Under **Session settings**:

| Setting                   | Options                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| Continue only after a win | On by default; losses, draws, or unknown results stop the session |
| Break                     | None, 2, 5, or 10 seconds                                         |
| Game limit                | Unlimited, 1, 3, 5, or 10 completed games                         |

Game limits and the stop-after-result rule also disable saved always-on mode. Unknown results count toward completed games, but not toward wins, losses, or draws. The extension waits briefly for a delayed result before deciding it is unknown.

### Move variation

When enabled, the extension has a 15% chance of choosing a calculated alternative in an eligible position. The alternative must be approximately 0.2–1.1 pawn units worse, have a sufficiently recent search depth, and not be evaluated as clearly losing. It does not vary a found mating line. If no eligible alternative exists, it uses the best found move.

The panel labels a varied move **Alternative**. Disable the option for best-found-move selection every time. This feature does not provide a detection-bypass guarantee.

### Scores and manual analysis

Scores are from White's perspective: positive favors White and negative favors Black. Standard international SAN uses N for knight, B for bishop, R for rook, Q for queen, and K for king.

Entering a manual FEN stops autoplay. Its arrow is drawn only if the FEN matches the recognized board position. Promotions use the visible promotion selector; if the board applies a different automatic queen promotion, autoplay stops.

## Permissions and limitations

| Permission            | Purpose                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `debugger`            | Send browser input to the extension's chess.com tab while autoplay is running |
| `storage`             | Persist preferences, including the always-on / stopped state                  |
| chess.com host access | Read the board and use the extension panel on the matching site               |

Chrome displays a browser-control notification while debugger control is connected. Stop disconnects it. Developer tools, another debugger, or administrator policies can prevent the connection. A move already played is not undone by Stop.

The extension uses the site's internal `board.game.getFEN()` interface and visible page controls. Website changes, unsupported game modes, covered controls, or inaccessible setup dialogs can interrupt it. English and German host-page labels are recognized; the extension's own interface and documentation are English. Language-recognition patterns are intentional inputs, not untranslated output.

The complete installed extension has **not** been tested against a signed-in live chess.com account in this environment. Tests use locally served, intercepted page fixtures. Actual unpacked-extension loading is blocked by the test environment's administrator policy. The fixtures exercise browser input through CDP while mocking extension APIs; they do not verify the real `chrome.debugger` permission dialog or every current chess.com selector.

## Repository layout

```text
extension/       Load this folder in Chrome or Edge
third_party/     Stockfish source archive, neural network, and checksums
scripts/         Integrity checks and ZIP packaging
tests/          Unit checks and intercepted browser-fixture tests
.github/         CI workflow and bug-report template
LICENSE          GNU GPL version 3
```

## Development and verification

Use Node.js 22+ and Python 3. Extension runtime files are already vendored; npm is only needed for development.

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

To use an existing Chromium executable, set `CHROMIUM_EXECUTABLE_PATH` before running browser tests. Otherwise Playwright uses its installed Chromium.

Browser tests intercept chess.com and serve local fixtures, including a German-language setup fixture to verify host-label compatibility. They do not sign in or enter real games. Checks cover delayed iframe loading, message origins, persistent autoplay, saved Stop / Esc, 5+0 selection, full next-game navigation, color changes, move validation, session limits, breaks, and variation selection.

```sh
npm run format
npm run format:check
npm run package
```

Packaging creates:

- `dist/x0_chessica-extension.zip`: installable folder, licenses, and corresponding Stockfish source materials.
- `dist/x0_chessica-github.zip`: upload-ready repository without dependencies, local artifacts, Git metadata, or hosting credentials.

GitHub Actions runs these checks and makes both ZIPs available as workflow artifacts. No repository secret is required.

## Upload to GitHub

This directory is ready to upload without source edits. Create an empty GitHub repository and upload the extracted repository contents, including `.github/`, `.gitignore`, and `.gitattributes`. Upload the contents rather than committing the ZIP as the only repository file.

Alternatively, initialize Git here, commit the files, and push to the remote URL supplied by GitHub. The repository intentionally contains no account-specific remote URL, author identity, API token, or hosting project configuration.

## License and dependencies

Project code is licensed under **GPL-3.0-only**; see [LICENSE](LICENSE). Third-party components retain their own notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [third_party/README.md](third_party/README.md) for versions, checksums, sources, and engine rebuild notes. Stockfish's corresponding source and the exact lite neural-network file are included alongside the binaries.
