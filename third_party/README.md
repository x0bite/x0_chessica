# Stockfish corresponding source

This directory accompanies the unmodified Stockfish.js 19.0.1 lite single-threaded JavaScript and WebAssembly files in `extension/vendor/`.

- `stockfish.js-19.0.1.tar.gz`: complete upstream tagged source archive, including C++ source, glue code, build script, and upstream notices.
- `nn-61e7af4bb97d.nnue`: the exact lite network referenced by that source and the bundled engine.
- `checksums.json`: SHA-256 hashes of these source materials and the vendored runtime files. `npm run check` verifies them.

Upstream tag: `v19.0.1`, resolved commit `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`.

Source: https://github.com/nmrugg/stockfish.js/tree/v19.0.1

Archive: https://codeload.github.com/nmrugg/stockfish.js/tar.gz/refs/tags/v19.0.1

Network: https://tests.stockfishchess.org/api/nn/nn-61e7af4bb97d.nnue

Network SHA-256: `61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b`.

## Rebuilding the engine

Extract the source archive, place the supplied `.nnue` file in the extracted `src/` directory, and follow the included upstream README. That release documents Emscripten **6.0.9**. With the documented toolchain available, the lite single-threaded build is selected with:

```sh
node build.js --lite --single-threaded --no-split
```

Run this command from the extracted upstream source directory. Build output normally goes to its `src/` directory. Keep the generated JavaScript and its matching WebAssembly file together when updating the extension. This project's extension itself needs no compilation. An engine rebuild and bit-for-bit reproduction of the published npm binary have not been performed here.

Do not remove source materials or notices from redistributed binary packages. The packaging script includes this directory in the installable ZIP as well as the repository ZIP.
