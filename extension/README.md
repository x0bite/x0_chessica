# x0_chessica 1.6.1

This is the loadable Chrome / Edge extension folder. It contains `manifest.json` directly.

Open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose Load unpacked, and select this folder. No npm installation or build is required. After an update, reload the extension and refresh chess.com.

The interface, messages, errors, and documentation are English. English and German chess.com page labels remain supported as inputs.

Always-on mode is enabled by default. Stop / Esc saves it as disabled. The browser must be running and the game tab active. Color is detected automatically, with manual overrides. Session settings include continue-only-after-win, break duration, and a game limit. The next-game target is 5+0 blitz. Move variation and manual FEN analysis are optional.

Engine assistance against other people violates chess.com's fair-play rules and can lead to a ban. Use for analysis and permitted training.

See the repository README for complete behavior, permissions, limitations, development checks, and publishing instructions. The installable release ZIP includes licenses and Stockfish source materials next to this file. In the source repository, these are at its root and under `third_party/`.
