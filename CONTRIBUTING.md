# Contributing

Use Node.js 22 or newer and Python 3. Run `npm ci`, `npm run check`, and `npm test` before submitting a change. Install Chromium with `npx playwright install chromium` and run `npm run test:browser` for changes to the overlay or browser control. Run `npm run format` before committing.

The browser tests intercept the chess.com host and serve local fixtures. They do not use an account or enter a real game. Keep fixture tests independent of real accounts and external services.

Keep interface text, errors, documentation, and comments in English. Recognition patterns may include other languages because those strings are inputs from the host website. Do not remove translated host-page recognition when changing the extension's own wording.

Never commit browser profiles, credentials, hosting configuration, local environment files, or personal game data. Preserve third-party licenses and update `third_party/checksums.json` only after verifying a dependency update.

Update both `package.json` and `extension/manifest.json` for a release, document it in `CHANGELOG.md`, and run `npm run package`. The package script creates both distributable archives in `dist/`.
