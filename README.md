# qrcode-hassle-free

A DSH web bundle that prints a **QR code and access link** to the `dsh web`
terminal on every start. Scan it with your phone camera and the harness opens
in the phone's browser — **inside your current session**, same workspace and
chat, no typing.

No Firebase. No database. No app install. Nothing is saved anywhere: the
tunnel URL is random per run and the QR is printed fresh each time.

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
7. Prints to the terminal:

```
──────────────────────────────────────────────────────────────
DSH Mobile — scan to open the harness on your phone:
(opens your current session — same workspace, same chat)

  ▄▄▄▄▄▄ ▄▄▄▄ ▄▄▄▄▄▄
  █ ▄▄▄ █ █▀▄█ █ ▄▄▄ █      ← scannable QR
  …

  https://<random>.trycloudflare.com/mobile-handoff?token=…
──────────────────────────────────────────────────────────────
```

## Requirements

- `cloudflared` on PATH (`winget install Cloudflare.cloudflared`)
- Phone on any network — the tunnel is public; the token in the URL is the
  only gate, so treat printed links like passwords.

## Install

Run `install.ps1` (copies the bundle into the dsh web profile and registers it
in the profile's bundle list), then restart `dsh web`.

## Removing

Delete the bundle rows from `C:\Users\<you>\.dsh\profiles\web\package.json`
(both `dependencies` and `dsh.profile.bundles`), remove
`node_modules\qrcode-hassle-free`, and restart `dsh web`.
