# Third-party notices

## Stockfish.js 19.0.1

The JavaScript loader and WebAssembly engine under `extension/vendor/stockfish-19-lite-single.*` are unmodified files from the published `stockfish@19.0.1` npm package.

- License: GNU GPL version 3; retain the original notices in `extension/vendor/Stockfish-LICENSE.txt` and the engine files.
- Upstream: https://github.com/nmrugg/stockfish.js
- Published package: https://registry.npmjs.org/stockfish/-/stockfish-19.0.1.tgz
- Corresponding source, network, version pin, and build notes: [third_party/README.md](third_party/README.md).

Stockfish and Stockfish.js are the work of their upstream contributors. Original copyright and contributor notices are retained in the files and source archive. This repository does not claim authorship of the engine.

## chess.js 1.4.0

`extension/vendor/chess.js` is the unmodified ESM distribution from `chess.js@1.4.0`.

- License: BSD-2-Clause, retained in `extension/vendor/chess-LICENSE.txt`.
- Source: https://github.com/jhlywa/chess.js/tree/v1.4.0
- Published package: https://registry.npmjs.org/chess.js/-/chess.js-1.4.0.tgz

## Development tools

Playwright and Prettier are development-only npm dependencies. Their own licenses apply when installed; they are not bundled in the extension. Their exact versions are recorded in `package-lock.json`.
