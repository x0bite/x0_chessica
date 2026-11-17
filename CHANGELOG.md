# Changelog

## 1.6.1

- Rename the extension, repository, documentation, and release packages to x0_chessica.
- Retain existing preference keys so installed users keep their settings.

## 1.6.0

- Translate the interface, accessibility labels, status messages, errors, and documentation into English.
- Keep English and German host-page recognition so existing site-language support continues to work.
- Add a clean upload-ready repository, dependency lockfile, CI workflow, integrity checks, and ZIP packaging.
- Include Stockfish corresponding source, its pinned lite network, dependency hashes, licenses, and third-party notices.
- Add portable verification scripts and document the distinction between fixture checks and live installed-extension verification.

## 1.5.1

- Wait for the overlay readiness handshake before sending messages.
- Buffer early state and retain only the latest position while the panel loads.
- Restore communication after a panel reload.

## 1.5.0

- Persist always-on mode and saved Stop / Esc behavior.
- Restart automatically on a visible game page after refresh.

## 1.4.0

- Verify 5+0 blitz selection before starting the next game.
- Add confirmed-win handling, breaks, game limits, session statistics, and saved preferences.

## Earlier versions

- Add local Stockfish analysis, move arrows, automatic color detection, configurable autoplay, next-game navigation, and optional move variation.
