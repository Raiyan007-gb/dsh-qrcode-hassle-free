# v1.2.0

## What changed

- **Zero runtime dependencies** — vendored the QR encoder in-tree, so installs no
  longer depend on `qrcode-terminal` being resolvable. Fixes "Cannot find module
  'qrcode-terminal/vendor/QRCode'" for `link:`/`file:` checkouts, and makes
  `dsh plugin add`/`remove` instant with no install scripts.
- **Auto-install cloudflared** — on first tunnel start the bundle probes `PATH`,
  and when no `cloudflared` exists it downloads the official pinned binary
  (SHA-256 verified), caches it under the user cache directory, and reuses it.
  An explicit **cloudflared path** override disables both probing and download.
- **Regenerate** — a new button in the card restarts the tunnel in place for a
  fresh URL on the same session, without restarting `dsh web`.
- **Auto tunnel target** — an empty tunnel target now resolves to the harness's
  own loopback address (`http://127.0.0.1:<port>`), replacing the hardcoded
  `localhost:3080` default.

## Install

```sh
dsh plugin --profile web add qrcode-hassle-free@latest --config.minimumReleaseAge=0
```

## License

MIT