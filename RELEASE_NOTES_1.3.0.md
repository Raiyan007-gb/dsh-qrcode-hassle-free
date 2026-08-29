# v1.3.0

## What changed

- **In-card Update** — the Settings → Plugins card now has a **Plugin update** section. It shows the running version, checks `https://registry.npmjs.org/qrcode-hassle-free/latest`, and when a newer release exists offers **Update available**. Clicking **Update** runs `pnpm add qrcode-hassle-free@latest` inside the owning profile directory (`$DSH_HOME/profiles/<name>` located by scanning for the `qrcode-hassle-free` install), then reports **Updated — restart dsh web to apply**. The three bridge routes (`/update-status`, `/check-update`, `/update`) are loopback-only, same as `/regenerate`. Local `link:`/`file:` installs are detected and not rewritten (`installed via "link:…" — update that checkout`).
- New zero-dep module `lib/update.js` (version compare, profile discovery via `realpathSync.native`, pnpm spawn with `shell: win32`).

## Install

```sh
dsh plugin --profile web add qrcode-hassle-free@latest --config.minimumReleaseAge=0
```

Or use the new **Check for updates** / **Update** button inside the card.

## License

MIT
