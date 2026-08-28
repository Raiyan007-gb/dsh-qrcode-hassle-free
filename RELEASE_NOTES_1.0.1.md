qrcode-hassle-free 1.0.1

Hassle-free remote access for DeepSeek Harness: a cloudflared quick tunnel plus
a scannable QR code and settings, shown in the Settings > Plugins page. No
database, no Firebase, no app install.

What it does
------------
* Spawns a loopback edge proxy that forwards every request and WebSocket
  upgrade to the harness, rewriting Host and Origin so the /api browser-trust
  fence accepts tunneled traffic (without it every /api call 403s).
* Spawns `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:<proxy>`
  and reads the random *.trycloudflare.com URL from stderr.
* Resolves this process's launch token via the connection service
  (authenticatedUrl), the same mint the console line prints.
* Seeds the most recently active session into every served index page and a
  token-gated /remote-handoff fallback route, so any tunnel entry — the QR
  link, the handoff route, or a manually typed URL — lands inside the session
  the desktop is working in. Desktop localhost/127.x is never touched.
* Registers a `remote-handoff` settings namespace and a loopback-only bridge
  (/api/dsh-remote-handoff-settings) that the Settings card reads for tunnel
  status (QR matrix + access link) and editable tunnelTarget /
  cloudflaredPath / sessionHandoff settings. The `dsh web` terminal prints
  nothing.

Changes in 1.0.1
----------------
* Remove `private: true` so the package can be published to the npm registry.
* Point repository.url at github.com/Raiyan007-gb/dsh-qrcode-hassle-free.

Requirements
------------
* `dsh` and Node (already needed by dsh)
* `cloudflared` on PATH

Install
-------
    dsh plugin --profile web add qrcode-hassle-free

License: MIT
