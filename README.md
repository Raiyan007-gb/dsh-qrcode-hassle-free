<div align="center">

# dsh-remote-tunnel-easy

<p align="center">
  <img src="assets/logo.svg" alt="dsh-remote-tunnel-easy" width="800">
</p>

**Open your DeepSeek Harness session on your phone — by pointing the camera at it.**

Scan the QR in **Settings → Plugins** and the harness opens in your phone's
browser, *inside the session you are already working in*. Same workspace, same
chat. No typing a URL. The `dsh web` terminal prints nothing.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/Raiyan007-gb/dsh-remote-tunnel-easy)](https://github.com/Raiyan007-gb/dsh-remote-tunnel-easy/stargazers)
[![Release](https://img.shields.io/github/v/release/Raiyan007-gb/dsh-remote-tunnel-easy)](https://github.com/Raiyan007-gb/dsh-remote-tunnel-easy/releases)
[![npm](https://img.shields.io/npm/v/dsh-remote-tunnel-easy?color=%23cb0000)](https://www.npmjs.com/package/dsh-remote-tunnel-easy)

</div>

A one-command **DeepSeek Harness web bundle** that brings QR-based remote
handoff to the Settings page. It starts a `cloudflared` quick tunnel, loops
your phone into the exact session the desktop is using, and draws the QR code
plus settings right next to your other plugins — no terminal noise, no
database, no Firebase, no app install.

- **Scan to open** — a real QR code in **Settings → Plugins**, fresh every run
- **Same session** — the phone lands inside the chat and workspace you are already in
- **Self-installing** — detects `cloudflared`, and downloads it (SHA-256 verified) when missing
- **Regenerate** — one click mints a fresh tunnel URL for the same session, without restarting
- **Editable settings** — tunnel target, `cloudflared` path, and session handoff from the page
- **Nothing stored** — the tunnel URL is random per run; nothing is saved anywhere
- **Everywhere** — Windows (x64/x86), macOS (Intel/Apple Silicon), and Linux (x64/arm64)

## At a Glance

| Question | Answer |
|----------|--------|
| **What is it?** | A `dsh` bundle that shows a scannable QR code and access link in the Settings page, so a phone opens the harness inside the active session. |
| **Who is it for?** | Anyone running `dsh web` who wants their phone on the same session without typing tunnel URLs and tokens. |
| **What do I get?** | A loopback edge proxy, a `cloudflared` quick tunnel, same-session handoff, and a live QR + settings card in **Settings → Plugins**. |
| **What does it run on?** | Windows, macOS, and Linux — anything `dsh` runs on. |
| **Is cloud required?** | No account or signup. `cloudflared` is used, and auto-downloaded on first run when missing; the tunnel is public, and the token in the link is the gate. |

---

## Get Started

Run `dsh web` once so a profile exists — that is the only prerequisite.
`cloudflared` is no longer something you install by hand: on first tunnel start
the bundle probes your `PATH`, and when no `cloudflared` is found it downloads
the official pinned binary (SHA-256 verified), caches it under your user cache
directory, and reuses it from then on. Prefer your own install? Put it on
`PATH`, or set the **cloudflared path** field in the card to an absolute path —
an explicit path disables both probing and downloading.

The simplest path — install from the npm registry with the plugin name:

```sh
dsh plugin --profile web add dsh-remote-tunnel-easy@latest --config.minimumReleaseAge=0
```

The `--config.minimumReleaseAge=0` flag bypasses pnpm's ~24-hour release-age
gate, so a freshly published version installs immediately. Without it, a plain
`dsh plugin --profile web add dsh-remote-tunnel-easy` still works but may hold off
until the freshness window lapses.

Or, if you prefer, install straight from the GitHub repository URL:

```sh
dsh plugin --profile web add https://github.com/Raiyan007-gb/dsh-remote-tunnel-easy
```

For a local checkout instead, clone it and add the folder:

```sh
git clone https://github.com/Raiyan007-gb/dsh-remote-tunnel-easy
dsh plugin --profile web add \./dsh-remote-tunnel-easy
```

These initialize the profile if needed, link the package, and register the
bundle. No build step — the package ships plain ESM with **zero runtime
dependencies** (the QR encoder and cloudflared resolver are vendored in-tree),
so `add` and `remove` stay fast and never run install scripts.

> **Security note:** installing from a git URL asks for permission to run the
> package's install scripts. This package has none (plain ESM, no
> `postinstall`), but pin a commit — `#<sha>` on the URL — to freeze what runs.
> To skip install permissions entirely, `pnpm pack` a tarball and
> `dsh plugin --profile web add ./dsh-remote-tunnel-easy-1.1.0.tgz`.

Then **restart** `dsh web` — the QR and settings appear on **Settings →
Plugins → DSH Remote** on every start.

---

## What it does

On every `dsh web` start the bundle:

1. Spawns a loopback edge proxy (127.0.0.1, ephemeral port) that forwards every
   request and WebSocket upgrade to the harness, rewriting `Host` and `Origin`
   to the loopback authority. This is what makes the harness's `/api`
   browser-trust fence accept tunneled traffic — the fence requires
   `Origin == Host`, and a phone's `Origin` is the tunnel hostname, which
   `--http-host-header` rewriting alone can never satisfy. Without the proxy
   the app loads but every API call 403s.
2. Locates `cloudflared` — the configured **cloudflared path** override, else a
   binary on `PATH`, else a pinned download (`2026.8.2`) SHA-256 verified and
   cached under the user cache directory. It then spawns
   `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:<proxy-port>`
   pointed at that proxy.
3. Waits for cloudflared to print the random `https://<name>.trycloudflare.com` URL.
4. Resolves this process's launch token via the harness connection service
   (`authenticatedUrl` — the same mint the console line prints).
5. Seeds the most recently active session id into every served index page (via
   the webserver's index-injection table), gated to non-loopback origins and
   once per tab — so any tunnel entry lands inside the session the desktop is
   working in. The id is resolved on the Host at render time (cached, refreshed
   every 15s); the phone makes no `/api` call for the seed itself.
6. Registers a token-gated `/remote-handoff` route as a fallback entry path:
   same seeding, then the normal token→cookie login (SHA-256 constant-time
   compare). Prefix-matched, so `/remote-handoff` and `/remote-handoff/` both work.
7. Registers a `remote-handoff` settings namespace and a loopback-only bridge
   (`/api/dsh-remote-handoff-settings`). The card in **Settings → Plugins →
   DSH Remote** reads the tunnel status (QR matrix + access link) from that
   bridge and draws them in the page, alongside the editable `tunnelTarget` /
   `cloudflaredPath` / `sessionHandoff` settings. The **Regenerate** button
   restarts the tunnel in place for a brand-new URL on the same session, and an
   empty **tunnel target** auto-fills the harness's own loopback address. The
   `dsh web` terminal prints nothing.

---

## Requirements

- No manual `cloudflared` install — downloaded automatically when missing
  (Windows x64/x86, macOS Intel/Apple Silicon, Linux x64/arm64); any other
  platform needs a `cloudflared` on `PATH` or an explicit **cloudflared path**.
- Network access on first run (to reach GitHub for the binary download)
- Node — already present where `dsh` runs
- Phone on any network — the tunnel is public; the token in the URL is the only
  gate, so treat the shown link like a password.

## Removing

```sh
dsh plugin --profile web remove dsh-remote-tunnel-easy
```

and restart `dsh web`.

---

## License

MIT — use it, modify it, ship it. See [LICENSE](LICENSE).

---

## Citation

If you use **dsh-remote-tunnel-easy** in your research or project, please cite:

```bibtex
@software{dsh_remote_tunnel_easy,
  title  = {dsh-remote-tunnel-easy: Hassle-free remote tunnel for DeepSeek Harness},
  author = {Raiyan},
  url    = {https://github.com/Raiyan007-gb/dsh-remote-tunnel-easy},
  year   = {2026},
  version = {1.4.1}
}
```

---

<div align="center">

*Built for the [DeepSeek Harness](https://github.com/Raiyan007-gb) — scan, open, keep working.*

</div>