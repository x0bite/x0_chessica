# x0_chessica

A Manifest V3 extension for Chrome and Edge with local Stockfish analysis, move arrows, and configurable browser automation on chess.com. Version **1.0.0**

> Engine assistance in games against other people violates chess.com's fair-play rules and can lead to an account ban. Use this project for analysis and permitted training. Neither wins nor undetected use are guaranteed.

## Install

No build, npm installation, API key, or server is needed to use the extension.

1. Download and extract the repository or the installable extension ZIP.
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Click **Load unpacked**.
4. For this repository, select **`extension/`**, which directly contains `manifest.json`. For the installable ZIP, select the extracted **`x0_chessica/`** folder.
5. Open or refresh a chess.com game tab.

To update, replace the files in the existing extension folder, reload the extension on the extensions page, and refresh the chess.com tab. If an old origin-mismatch error is still listed, clear the stored error entry after updating.

**Always on is enabled by default.** Once a visible board on a game page is recognized, autoplay starts without a Start click. Turn off **Always on**, or press **Stop / Esc**, before opening a game if you only want to inspect the interface.

The browser must be running and the game tab must be active.

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

## License and dependencies

Project code is licensed under **GPL-3.0-only**; see [LICENSE](LICENSE). Third-party components retain their own notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [third_party/README.md](third_party/README.md) for versions, checksums, sources, and engine rebuild notes. Stockfish's corresponding source and the exact lite neural-network file are included alongside the binaries.
