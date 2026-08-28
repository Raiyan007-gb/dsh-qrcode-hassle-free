<div align="center">

# qrcode-hassle-free

<p align="center">
  <img src="assets/logo.svg" alt="qrcode-hassle-free" width="800">
</p>

**Open your DeepSeek Harness session on your phone — by pointing the camera at it.**

Scan the QR in **Settings → Plugins** and the harness opens in your phone's
browser, *inside the session you are already working in*. Same workspace, same
chat. No typing a URL. The `dsh web` terminal prints nothing.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/Raiyan007-gb/dsh-qrcode-hassle-free)](https://github.com/Raiyan007-gb/dsh-qrcode-hassle-free/stargazers)
[![Release](https://img.shields.io/github/v/release/Raiyan007-gb/dsh-qrcode-hassle-free)](https://github.com/Raiyan007-gb/dsh-qrcode-hassle-free/releases)
[![npm](https://img.shields.io/npm/v/qrcode-hassle-free?color=%23cb0000)](https://www.npmjs.com/package/qrcode-hassle-free)

</div>

A one-command **DeepSeek Harness web bundle** that brings QR-based remote
handoff to the Settings page. It starts a `cloudflared` quick tunnel, loops
your phone into the exact session the desktop is using, and draws the QR code
plus settings right next to your other plugins — no terminal noise, no
database, no Firebase, no app install.

- **Scan to open** — a real QR code in **Settings → Plugins**, fresh every run
- **Same session** — the phone lands inside the chat and workspace you are already in
- **Editable settings** — tunnel target, `cloudflared` path, and session handoff from the page
- **Nothing stored** — the tunnel URL is random per run; nothing is saved anywhere
- **Everywhere** — Windows, macOS, and Linux

## At a Glance

| Question | Answer |
|----------|--------|
| **What is it?** | A `dsh` bundle that shows a scannable QR code and access link in the Settings page, so a phone opens the harness inside the active session. |
| **Who is it for?** | Anyone running `dsh web` who wants their phone on the same session without typing tunnel URLs and tokens. |
| **What do I get?** | A loopback edge proxy, a `cloudflared` quick tunnel, same-session handoff, and a live QR + settings card in **Settings → Plugins**. |
| **What does it run on?** | Windows, macOS, and Linux — anything `dsh` runs on. |
| **Is cloud required?** | No. Only `cloudflared` on `PATH` is needed; the tunnel is public, and the token in the link is the gate. |

---

## Get Started

Prerequisite: install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
(`winget install Cloudflare.cloudflared` on Windows, `brew install cloudflared`
on macOS, or the `.deb`/binary on Linux) and run `dsh web` once so a profile
exists.

The simplest path — install from the npm registry with the plugin name:

```sh
dsh plugin --profile web add qrcode-hassle-free
```

Or, if you prefer, install straight from the GitHub repository URL:

```sh
dsh plugin --profile web add https://github.com/Raiyan007-gb/dsh-qrcode-hassle-free
```

For a local checkout instead, clone it and add the folder:

```sh
git clone https://github.com/Raiyan007-gb/dsh-qrcode-hassle-free
dsh plugin --profile web add ./dsh-qrcode-hassle-free
```

These initialize the profile if needed, link the package, install
`qrcode-terminal`, and register the bundle. No build step — the package ships
plain ESM.

> **Security note:** installing from a git URL asks for permission to run the
> package's install scripts. This package has none (plain ESM, no
> `postinstall`), but pin a commit — `#<sha>` on the URL — to freeze what runs.
> To skip install permissions entirely, `pnpm pack` a tarball and
> `dsh plugin --profile web add ./qrcode-hassle-free-1.0.0.tgz`.

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
2. Spawns `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:<proxy-port>`
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
   `cloudflaredPath` / `sessionHandoff` settings. The `dsh web` terminal prints
   nothing.

---

## Requirements

- `cloudflared` on `PATH`
- Node — already present where `dsh` runs
- Phone on any network — the tunnel is public; the token in the URL is the only
  gate, so treat the shown link like a password.

## Removing

```sh
dsh plugin --profile web remove qrcode-hassle-free
```

and restart `dsh web`.

---

## License

MIT — use it, modify it, ship it. See [LICENSE](LICENSE).

---

<div align="center">

*Built for the [DeepSeek Harness](https://github.com/Raiyan007-gb) — scan, open, keep working.*

</div>