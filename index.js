/**
 * qrcode-hassle-free node half — tunnel + terminal QR + same-session handoff
 * for the DSH Web API.
 *
 * On every start this bundle:
 *   1. spawns `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:<ephemeral>`
 *      where the ephemeral port is a loopback edge proxy this bundle also
 *      spawns, forwarding every request and upgrade to the harness target,
 *   2. extracts the random trycloudflare.com URL from cloudflared's stderr,
 *   3. resolves this process's launch token through the connection service's
 *      authenticatedUrl (same mint the console line prints),
 *   4. prints the combined URL + a scannable QR code to the terminal,
 *   5. seeds the harness's most recently active session into the served index
 *      page itself, so ANY entry path — the QR link, the handoff route, or a
 *      manually typed tunnel URL — lands inside the exact session the desktop
 *      is working in: same workspace, same chat.
 *
 * The edge proxy exists because the harness /api browser-trust fence
 * (packages/client/connection/src/api-request-trust.ts) requires an attached
 * Origin to equal the request Host, and browser-auth binds the session cookie
 * to the Host authority. cloudflared rewrote Host to the loopback target, but
 * the phone browser's Origin stayed `https://<tunnel>` — the app loaded
 * (token login and cookie succeeded over the rewritten Host) while every
 * /api call 403'd: sessions lists rendered empty through the tunnel. The
 * proxy equalizes the pair per request — Host → `localhost:3080`, Origin →
 * `http://localhost:3080` — and passes WebSocket upgrades through the same
 * rewrite, so tunneled traffic is indistinguishable from desktop traffic.
 *
 * Seeding rides the webserver's index-injection table, applied by the static
 * fallback owner on every index render. Two gates keep it surgical:
 *   - Host gate: the seed script reads the page's own location and no-ops on
 *     loopback/lan origins, so desktop use of the app is never touched. The
 *     session id is resolved on the Host at render time (cached, refreshed
 *     on a short interval), so the phone browser makes no /api call for the
 *     seed itself.
 *   - One-shot gate: the script stamps sessionStorage after seeding, so the
 *     write happens once per tab visit; afterwards the app's own navigation
 *     is authoritative and refreshes keep whatever the user chose.
 *
 * No database, no Firebase, no persisted state. A tree without
 * webServer/connection/sessionController keeps the rows pending, matching
 * the lan-access bundle contract. Disposal kills the cloudflared child, the
 * proxy, and the refresh timer.
 */

const TOKEN_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
const HANDOFF_PATH = '/mobile-handoff'
/** How often the Host re-resolves the active session for index seeding. */
const SESSION_REFRESH_MS = 15_000

/** Launch token of this process, extracted from the authenticated index URL. */
function launchToken(connection) {
  const authenticated = connection.authenticatedUrl('http://localhost:3080')
  return new URL(authenticated).searchParams.get('token') ?? ''
}

function apply(ctx, config) {
  ctx.effect(() => {
    // startTunnel resolves asynchronously (the edge proxy binds first); track
    // its disposer whenever it lands, and dispose immediately when it lands
    // after teardown — no orphaned proxy or cloudflared child either way.
    const disposers = [registerHandoff(ctx, config), registerIndexSeed(ctx, config)]
    let torn = false
    const track = (disposer) => {
      if (torn) disposer()
      else disposers.push(disposer)
    }
    void startTunnel(ctx, config).then(track).catch((err) => {
      console.error(`qrcode-hassle-free: ${err.message}`)
    })
    return () => {
      torn = true
      disposers.forEach((dispose) => { dispose() })
    }
  }, 'qrcode-hassle-free: tunnel + QR + session handoff')
}

/**
 * Pick the session the QR should open: the newest ordinary, non-blank
 * summary by updatedAt (the sort is explicit because the wire's
 * activity ordering is a courtesy, not a contract). Blank sessions are
 * skipped so a just-created empty session never wins; subagent rows are
 * skipped because the client selects them through their parent's catalog,
 * not as bare session ids.
 * @returns session id, or undefined when no ordinary session exists.
 */
export function pickActiveSession(summaries) {
  const candidates = summaries.filter(s => s.blank !== true && s.origin === undefined)
  if (candidates.length === 0) return undefined
  candidates.sort((a, b) => b.updatedAt - a.updatedAt)
  return candidates[0]?.sessionId
}

/** Length-safe constant-time equality of two token strings via their SHA-256 digests. */
function tokensMatch(candidate, expected) {
  const crypto = process.getBuiltinModule('node:crypto')
  const a = crypto.createHash('sha256').update(candidate).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

/** The handoff page: seed the persisted selection, then continue the normal login. */
function handoffHtml(sessionId, continueUrl) {
  // Stringify twice: the inner JSON is the storage cell text, the outer
  // literal embeds it (and the URL) without any markup-breaking characters.
  const cell = JSON.stringify({ sessionId }).replaceAll('<', '\\u003c')
  return [
    '<!doctype html><html><head><meta charset="utf-8"><title>Opening harness…</title></head><body>',
    `<script>try{localStorage.setItem('dsh.sessions.current',${JSON.stringify(cell)})}catch(e){}`,
    `location.replace(${JSON.stringify(continueUrl)})</script>`,
    `<noscript><a href="${continueUrl.replaceAll('"', '&quot;')}">Continue to the harness</a></noscript>`,
    '</body></html>',
  ].join('')
}

/**
 * Serve the token-gated handoff over a plain webServer route (no fence, no
 * cookie requirement): the launch token in the query is the credential, the
 * same secret that guards the index. Prefix match so both /mobile-handoff
 * and /mobile-handoff/ reach the handler — the exact match refused the
 * trailing slash, which phones downloaded as a 404 .txt. Every scan
 * re-resolves the live active session; plain index visits never seed here
 * (the index injection covers them), so desktop use is untouched.
 */
function registerHandoff(ctx, config) {
  if (config.sessionHandoff === false) return () => {}
  const expected = launchToken(ctx.connection)
  const handler = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://dsh.invalid')
    const token = url.searchParams.get('token') ?? ''
    if (expected === '' || !tokensMatch(token, expected)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end('not found\n')
      return
    }
    let sessionId
    try {
      const value = await ctx.sessionController.list({}, AbortSignal.timeout(5000))
      sessionId = pickActiveSession(value.items ?? [])
    } catch {
      // List unavailable (e.g. during boot): fall through to the plain login
      // — the QR still works, it just opens the app's default state.
    }
    const continueUrl = `/?token=${encodeURIComponent(token)}`
    if (sessionId === undefined) {
      res.writeHead(303, { 'cache-control': 'no-store', location: continueUrl, 'referrer-policy': 'no-referrer' })
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
    res.end(handoffHtml(sessionId, continueUrl))
  }
  // Prefix match (not exact) so both /mobile-handoff and /mobile-handoff/…
  // reach the handler — the webserver's exact match refuses the trailing
  // slash, which phones previously downloaded as a 404 .txt. The handler
  // ignores the pathname and parses the query itself, and no other route
  // begins with /mobile-handoff, so the wider match cannot shadow anything.
  return ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: HANDOFF_PATH, handler }),
    `qrcode-hassle-free: ${HANDOFF_PATH} handoff route`,
  )
}

/**
 * Seed the app's persisted selection directly into the served index page so
 * ANY tunnel entry (QR link, handoff, or a manually typed tunnel URL) opens
 * the harness's active session. The Host resolves the session id at render
 * time through a short-interval cache; the injected script applies it only
 * for non-loopback origins (desktop localhost is never touched) and only
 * once per browser tab (sessionStorage flag), after which the app's own
 * navigation is authoritative.
 */
function registerIndexSeed(ctx, config) {
  if (config.sessionHandoff === false) return () => {}
  let cachedSessionId
  const refresh = async () => {
    try {
      const value = await ctx.sessionController.list({}, AbortSignal.timeout(5000))
      cachedSessionId = pickActiveSession(value.items ?? [])
    } catch {
      // List unavailable (e.g. mid-boot): keep the previous value; an
      // undefined cache simply renders without the seed.
    }
  }
  void refresh()
  const timer = setInterval(() => { void refresh() }, SESSION_REFRESH_MS)
  const row = () => ({
    kind: 'script',
    placement: 'head',
    // Loopback gate: desktop origins the app is normally served on
    // (localhost names, 127/8, ::1) never seed, so LAN-IP desktop use via
    // the lan-access bundle and plain localhost use are both untouched.
    text: [
      'try{(function(){',
      'var h=location.hostname;',
      'var loopback=(h==="localhost"||h.slice(-10)===".localhost"||h.startsWith("127.")||h==="::1"||h==="[::1]");',
      'if(loopback)return;',
      'if(sessionStorage.getItem("__dsh_qr_seeded"))return;',
      'var sid=globalThis.__DSH_QR_SESSION__;',
      'if(!sid)return;',
      'sessionStorage.setItem("__dsh_qr_seeded","1");',
      "localStorage.setItem('dsh.sessions.current',",
      'JSON.stringify({sessionId:sid}));',
      '})()}catch(e){}',
    ].join(''),
  })
  ctx.on('webserver/index-inject', (table) => {
    if (cachedSessionId !== undefined) {
      table.push({ kind: 'global', name: '__DSH_QR_SESSION__', value: cachedSessionId })
      table.push(row())
    }
  })
  return () => clearInterval(timer)
}

/**
 * Loopback edge proxy between cloudflared and the harness. Equalizes the
 * Host/Origin pair the /api trust fence checks (see the module docblock) and
 * forwards everything else untouched. Binds 127.0.0.1 only — the tunnel is
 * the sole remote client, and no LAN attacker can reach the rewrite without
 * first possessing the loopback boundary. WebSocket upgrades are piped raw
 * after the same header rewrite.
 * @param config - bundle config; uses `tunnelTarget` as the upstream.
 * @returns disposer closing the server, its sockets, and tracked upstreams.
 */
function startEdgeProxy(config) {
  const http = process.getBuiltinModule('node:http')
  const target = new URL(config.tunnelTarget ?? 'http://localhost:3080')
  const upstreamAuthority = target.host
  const webSocketKey = 'sec-websocket-key'

  const server = http.createServer((req, res) => {
    // cloudflared → proxy is a fixed loopback hop carrying public-request
    // headers only; replace (never merge) the two fence-checked values.
    req.headers.host = upstreamAuthority
    req.headers.origin = `http://${upstreamAuthority}`
    // setHost:false keeps the rewritten Host header verbatim — the options
    // host otherwise overrides it and the fence sees the wrong authority.
    const upstream = http.request({ host: target.hostname, port: target.port, path: req.url, method: req.method, headers: req.headers, setHost: false }, (up) => {
      res.writeHead(up.statusCode, up.headers)
      up.pipe(res)
    })
    upstream.on('error', () => {
      if (res.headersSent) { res.destroy(); return }
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('harness upstream unreachable\n')
    })
    req.pipe(upstream)
  })

  server.on('upgrade', (req, socket) => {
    req.headers.host = upstreamAuthority
    req.headers.origin = `http://${upstreamAuthority}`
    // setHost:false keeps the rewritten Host verbatim (see the GET path).
    const upstream = http.request({
      host: target.hostname,
      port: target.port,
      path: req.url,
      headers: { ...req.headers, connection: 'Upgrade', upgrade: req.headers.upgrade },
      setHost: false,
    })
    upstream.on('upgrade', (upRes, upSocket, upHead) => {
      // Tunnel to tunnel: forward the 101 and raw bytes both ways.
      const reply = [`HTTP/1.1 ${upRes.statusCode} ${upRes.statusMessage}`]
      for (const [name, value] of Object.entries(upRes.headers)) {
        if (value !== undefined) reply.push(`${name}: ${Array.isArray(value) ? value.join(', ') : value}`)
      }
      socket.write(`${reply.join('\r\n')}\r\n\r\n`)
      if (upHead.length > 0) socket.write(upHead)
      upSocket.pipe(socket)
      socket.pipe(upSocket)
      const die = () => { socket.destroy(); upSocket.destroy() }
      socket.on('error', die)
      upSocket.on('error', die)
      socket.on('close', die)
      upSocket.on('close', die)
    })
    upstream.on('error', () => { socket.destroy() })
    upstream.end()
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        dispose: () => {
          server.closeAllConnections()
          server.close()
        },
      })
    })
  })
}

/**
 * Run cloudflared for the fiber's lifetime and print the QR once the random
 * URL appears on stderr. cloudflared points at the loopback edge proxy (not
 * the harness directly) so tunneled requests arrive fence-clean. Reconnect
 * loops are unnecessary: quick tunnels live for the child's lifetime and the
 * effect dies with the plugin.
 */
async function startTunnel(ctx, config) {
  const cp = process.getBuiltinModule('node:child_process')
  const upstream = await startEdgeProxy(config)
  const child = cp.spawn(config.cloudflaredPath ?? 'cloudflared', [
    'tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${String(upstream.port)}`,
  ], { windowsHide: true })

  let printed = false

  const publish = async (tunnelUrl) => {
    const token = launchToken(ctx.connection) ?? ''
    const accessUrl = `${tunnelUrl}${HANDOFF_PATH}?token=${encodeURIComponent(token)}`
    // Lazy-load the bundled qrcode-terminal so a tunnel failure never
    // prevents the route tree from mounting. The package is CJS: generate
    // lives on module.exports and reads `this.error`, so it must be invoked
    // as a method of that record, never extracted and called unbound.
    const mod = await import('qrcode-terminal')
    const qrModule = mod.default ?? mod
    console.log('')
    console.log('─'.repeat(62))
    console.log('DSH Mobile — scan to open the harness on your phone:')
    console.log('(opens your current session — same workspace, same chat)')
    console.log('')
    qrModule.generate(accessUrl, { small: true }, (qr) => {
      console.log(qr)
      console.log(`  ${accessUrl}`)
      console.log('─'.repeat(62))
      console.log('')
    })
  }

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    const match = TOKEN_RE.exec(chunk)
    if (match !== null && !printed) {
      printed = true
      void publish(match[0]).catch((err) => {
        console.error(`qrcode-hassle-free: ${err.message}`)
      })
    }
  })
  child.on('exit', (code) => {
    if (!printed) console.error(`qrcode-hassle-free: cloudflared exited early (code ${String(code)}) — no QR printed`)
  })

  const retry = setTimeout(() => {
    if (!printed) console.error('qrcode-hassle-free: no tunnel URL after 60s — cloudflared may be offline')
  }, 60_000)

  return () => {
    clearTimeout(retry)
    child.kill()
    upstream.dispose()
  }
}

export const name = 'qrcode-hassle-free'
export const inject = ['webServer', 'connection', 'sessionController']
export { apply, startEdgeProxy }
