# qrcode-hassle-free

A DSH web bundle that shows a **QR code, access link, and settings** in the
DeepSeek Harness **Settings → Plugins** page. Scan the QR with your phone
camera and the harness opens in the phone's browser — **inside your current
session**, same workspace and chat, no typing. The `dsh web` terminal prints
nothing.

No Firebase. No database. No app install. Nothing is saved anywhere: the
tunnel URL is random per run and the QR is generated fresh each time.

Works on **Windows, macOS, and Linux** — the only runtime requirements are
`dsh`, Node (which dsh already needs), and `cloudflared` on PATH.

## What it does

On every `dsh web` start the bundle:

1. Spawns a loopback edge proxy (127.0.0.1, ephemeral port) that forwards
  every request and WebSocket upgrade to the harness, rewriting the `Host`
   and `Origin` headers to the loopback authority — this is what makes the
   harness's /api browser-trust fence accept tunneled traffic (the fence
   requires Origin == Host, and a phone browser's Origin is the tunnel
   hostname, which `--http-host-header` rewriting alone can never satisfy;
   without the proxy the app loads but every API call 403s and the session
   list renders empty).
2. Spawns `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:<proxy-port>`
  pointed at that proxy.
3. Waits for cloudflared to print the random `https://<name>.trycloudflare.com` URL.
4. Resolves this process's launch token via the harness connection service
  (`authenticatedUrl` — the same mint the console line prints).
5. Seeds the harness's most recently active session into every served index
  page (via the webserver's index-injection table), gated to non-loopback
   origins and once per browser tab — so **any** tunnel entry (the QR link,
   the handoff route, or a manually typed tunnel URL) lands inside the
   session the desktop is working in; desktop `localhost`/`127.x` use is
   never touched. The session id is resolved on the Host at render time
   (cached, refreshed every 15s); the phone browser makes no `/api` call for
   the seed itself.
6. Registers a token-gated `/mobile-handoff` route as a fallback entry path:
  same seeding, then continues into the normal token→cookie login. The
   route is guarded by the same launch token as the index (SHA-256
   constant-time compare). Prefix-matched so both `/mobile-handoff` and
   `/mobile-handoff/` work.
7. Registers a `mobile-handoff` settings namespace and a loopback-only bridge
  (`/api/dsh-mobile-handoff-settings`). The browser card in **Settings →
   Plugins → DSH Mobile** reads the tunnel status (QR matrix + access link)
   from that bridge and draws them in the page, alongside the editable
   `tunnelTarget` / `cloudflaredPath` / `sessionHandoff` settings. The `dsh web`
   terminal prints nothing.



## Install (all platforms)

The traditional dsh way: bundles are plain npm packages with a
`dsh.bundle` manifest, installed into a profile with the `dsh plugin`
CLI (which forwards to pnpm). No build step — the package ships plain ESM.

Prerequisite: install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
(`winget install Cloudflare.cloudflared` on Windows, `brew install cloudflared`
on macOS, or the `.deb`/binary from the download page on Linux) and make sure
`dsh web` has been run once so the profile exists.

From the parent directory of the checkout (or any directory, using the git
URL directly):

```sh
dsh plugin --profile web add https://github.com/Raiyan007-gb/dsh-qrcode-hassle-free
```

That single command initializes the profile if needed, links the package,
installs `qrcode-terminal`, and registers the bundle. For a local checkout
instead:

```sh
git clone https://github.com/Raiyan007-gb/dsh-qrcode-hassle-free
dsh plugin --profile web add ./dsh-qrcode-hassle-free
```

> **Security note:** installing from a git URL asks for permission to run the
> package's install scripts on your machine. This package has none (plain ESM,
> no `postinstall`), but pin a commit — `#<sha>` suffix on the URL — if you
> want to freeze what runs. The alternative is `pnpm pack` a tarball and
> `dsh plugin add ./qrcode-hassle-free-1.0.0.tgz`, which needs no build
> permission at all.

Then **restart** `dsh web` — the QR and settings appear on the Settings →
Plugins page on every start.

## Removing

```sh
dsh plugin --profile web remove dsh-qrcode-hassle-free
```

and restart `dsh web`.

## Requirements

- `cloudflared` on PATH
- Phone on any network — the tunnel is public; the token in the URL is the
only gate, so treat the shown link like a password.

