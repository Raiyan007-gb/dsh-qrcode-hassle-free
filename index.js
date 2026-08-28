/**
 * qrcode-hassle-free node half — tunnel + Settings-page QR + same-session
 * handoff for the DSH Web API.
 *
 * On every start this bundle:
 *   1. spawns `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:<ephemeral>`
 *      where the ephemeral port is a loopback edge proxy this bundle also
 *      spawns, forwarding every request and upgrade to the harness target,
 *   2. extracts the random trycloudflare.com URL from cloudflared's stderr,
 *   3. resolves this process's launch token through the connection service's
 *      authenticatedUrl,
 *   4. computes the combined URL + a QR matrix and publishes them to a
 *      loopback-only bridge the Settings page card renders — the dsh web
 *      terminal prints nothing,
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

import { installSettingsSection, settingsNamespace, SettingsConflictError } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { resolveCloudflared } from './lib/cloudflared.js'
import { encodeQrMatrix } from './lib/qrcode.js'

const TOKEN_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
const HANDOFF_PATH = '/remote-handoff'
/** Settings namespace the browser card edits (Settings → Plugins → configurable). */
const REMOTE_HANDOFF_NS = settingsNamespace('remote-handoff')
/** Loopback-only HTTP bridge the card reads config + tunnel status through. */
const BRIDGE_PREFIX = '/api/dsh-remote-handoff-settings'
/** How often the Host re-resolves the active session for index seeding. */
const SESSION_REFRESH_MS = 15_000

/**
 * Bundle config schema. The same object the Settings page edits: `tunnelTarget`
 * is the local harness the quick tunnel forwards to (empty means "auto" — the
 * running webserver's loopback URL), `cloudflaredPath` names the cloudflared
 * binary (empty means "probe PATH, else auto-download"; any non-empty value is
 * an override that disables both), `autoInstallCloudflared` gates the lazy
 * download, and `sessionHandoff` gates the token-gated handoff route and index
 * seed. The QR/link it emits is never printed to the terminal — the browser
 * card fetches it from the loopback bridge and draws the matrix.
 */
const Config = z.object({
  tunnelTarget: z.string().default(''),
  cloudflaredPath: z.string().default(''),
  autoInstallCloudflared: z.boolean().default(true),
  sessionHandoff: z.boolean().default(true),
})

/** Launch token of this process, extracted from the authenticated index URL. */
function launchToken(connection) {
  const authenticated = connection.authenticatedUrl('http://localhost:3080')
  return new URL(authenticated).searchParams.get('token') ?? ''
}

/**
 * Resolve the tunnel upstream from config: an explicit `tunnelTarget` wins,
 * otherwise the running webserver's canonical loopback URL. `webServer` port
 * is the same source `web-app` uses for its own `dsh web` URL, so the auto
 * value can never drift from where the harness actually listens.
 */
function resolveTarget(config, webServer) {
  if (typeof config.tunnelTarget === 'string' && config.tunnelTarget !== '') return config.tunnelTarget
  return `http://127.0.0.1:${String(webServer.port)}`
}

function apply(ctx, config) {
  // The live settings source: composition `config` until a settings provider
  // attaches, then its resolved scope (see installSettingsSection below).
  let current = () => config ?? {}

  // Tunnel status shared with the loopback bridge. The browser card polls
  // /status to draw the QR and link; nothing is ever written to the terminal.
  const status = {
    state: 'starting',
    tunnelUrl: null,
    accessUrl: null,
    matrix: null,
    error: null,
    phase: null,
    resolvedTarget: null,
  }
  /** Registered regenerate handler; replaced by the tunnel effect once ready. */
  let regenerate = null

  installSettingsSection(ctx, REMOTE_HANDOFF_NS, Config, config ?? {}, {
    setSource: (source) => { current = source },
    onChange: () => {},
  })

  ctx.inject(['webServer', 'settings'], (sctx) => {
    sctx.effect(() => {
      const disposers = makeBridgeRoutes(sctx.settings, () => status, () => regenerate).map((route) => sctx.webServer.register(route))
      return () => { disposers.forEach((dispose) => dispose()) }
    }, 'qrcode-hassle-free: settings + status bridge')
  })

  ctx.effect(() => {
    // Resolve the startup config once: tunnel target, cloudflared path, and the
    // handoff switch are read when the tunnel/handoff/seed registrations begin,
    // matching the original startup-time semantics. Live settings edits update
    // `current` for the bridge, but do not restart an already-running tunnel
    // (an explicit "Regenerate" is the only restart trigger).
    const startup = current()
    const disposers = [registerHandoff(ctx, startup), registerIndexSeed(ctx, startup)]
    let torn = false
    let active = null
    let inFlight = false

    const resetStatus = () => {
      status.state = 'starting'
      status.tunnelUrl = null
      status.accessUrl = null
      status.matrix = null
      status.error = null
    }

    const resolveBinary = async () => {
      status.phase = 'downloading cloudflared…'
      return resolveCloudflared(startup, (phase) => { status.phase = phase })
    }

    // Start a tunnel to the resolved target using the resolved binary path.
    const launch = async () => {
      const target = resolveTarget(startup, ctx.webServer)
      status.resolvedTarget = target
      const binary = await resolveBinary().finally(() => { status.phase = null })
      status.phase = 'starting tunnel…'
      return startTunnel(ctx, { ...startup, tunnelTarget: target }, status, binary.path)
    }

    // Replace the live tunnel with a fresh one (regenerate). Safe against
    // concurrent calls: a second request while one is in flight is rejected.
    regenerate = async () => {
      if (torn) return { ok: false, code: 'disposed', message: 'plugin is disposed' }
      if (inFlight) return { ok: false, code: 'busy', message: 'already regenerating' }
      inFlight = true
      try {
        if (active !== null) { active(); active = null }
        resetStatus()
        active = await launch()
        return { ok: true, value: { state: 'starting' } }
      } catch (err) {
        status.state = 'failed'
        status.phase = null
        status.error = err instanceof Error ? err.message : String(err)
        console.error(`qrcode-hassle-free: ${err.message}`)
        return { ok: false, code: 'failed', message: status.error }
      } finally {
        inFlight = false
      }
    }

    void launch().then((disposer) => { active = disposer }).catch((err) => {
      status.state = 'failed'
      status.phase = null
      status.error = err instanceof Error ? err.message : String(err)
      console.error(`qrcode-hassle-free: ${err.message}`)
    })

    return () => {
      torn = true
      regenerate = null
      if (active !== null) active()
      disposers.forEach((dispose) => { dispose() })
    }
  }, 'qrcode-hassle-free: tunnel + QR + session handoff')
}

const MAX_JSON_BODY_BYTES = 64 * 1024

/** Only requests originating from this machine's loopback are served. */
function isLoopbackRequest(request) {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl
  try {
    hostUrl = new URL('http://' + host)
  } catch {
    return false
  }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

function writeJson(res, statusCode, body) {
  const payload = JSON.stringify(body)
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk
    size += buffer.length
    if (size > MAX_JSON_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}

/** Project a settings descriptor to the wire view the card consumes. */
function toView(descriptor) {
  return {
    ns: String(descriptor.ns),
    schema: descriptor.schema,
    value: descriptor.value,
    ...(descriptor.base === undefined ? {} : { base: descriptor.base }),
    ...(descriptor.user === undefined ? {} : { user: descriptor.user }),
    revision: descriptor.revision,
  }
}

/** Build the loopback-only bridge routes (settings describe/mutate + tunnel status + regenerate). */
function makeBridgeRoutes(settings, getStatus, getRegenerate) {
  const allowlisted = () =>
    settings
      .describe({ redactSecrets: true })
      .filter((descriptor) => String(descriptor.ns) === String(REMOTE_HANDOFF_NS))
      .map((descriptor) => String(descriptor.ns))

  const handlers = {
    async describe() {
      const descriptors = settings.describe({ redactSecrets: true })
      return {
        ok: true,
        value: {
          namespaces: allowlisted()
            .map((ns) => descriptors.find((descriptor) => String(descriptor.ns) === ns))
            .filter((descriptor) => descriptor !== undefined)
            .map(toView),
          writable: settings.writable !== false,
        },
      }
    },
    async mutate(request) {
      const body = request
      if (body === null || typeof body !== 'object' || typeof body.ns !== 'string' || !Array.isArray(body.ops)) {
        return { ok: false, code: 'settings-rejected', message: 'malformed bridge settings request' }
      }
      const { ns } = body
      if (!allowlisted().includes(ns)) {
        return { ok: false, code: 'settings-not-exposed', message: `settings namespace "${ns}" is not exposed` }
      }
      const expectedRevision = typeof body.expectedRevision === 'number' ? body.expectedRevision : undefined
      try {
        await settings.mutate(settingsNamespace(ns), body.ops, expectedRevision)
      } catch (error) {
        if (error instanceof SettingsConflictError) {
          return { ok: false, code: 'settings-conflict', message: error.message }
        }
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, code: 'internal', message }
      }
      const descriptor = settings.describe({ redactSecrets: true }).find((candidate) => String(candidate.ns) === ns)
      if (descriptor === undefined) {
        return { ok: false, code: 'internal', message: `settings namespace "${ns}" was disposed after the mutate` }
      }
      return { ok: true, value: toView(descriptor) }
    },
    async status() {
      const s = getStatus()
      return {
        ok: true,
        value: {
          state: s.state,
          ...(s.tunnelUrl === null ? {} : { tunnelUrl: s.tunnelUrl }),
          ...(s.accessUrl === null ? {} : { accessUrl: s.accessUrl }),
          ...(s.matrix === null ? {} : { matrix: s.matrix }),
          ...(s.error === null ? {} : { error: s.error }),
          ...(s.phase === null ? {} : { phase: s.phase }),
          ...(s.resolvedTarget === null ? {} : { resolvedTarget: s.resolvedTarget }),
        },
      }
    },
    async regenerate() {
      // Serialize through the effect's mutex; concurrent clicks fail with "busy".
      if (typeof getRegenerate() !== 'function') {
        return { ok: false, code: 'not-ready', message: 'regenerate is not available yet' }
      }
      return getRegenerate()()
    },
  }

  const guard = (req, res) => {
    if (!isLoopbackRequest(req)) {
      writeJson(res, 403, { error: 'loopback requests only' })
      return false
    }
    if (req.method !== 'POST') {
      writeJson(res, 405, { error: `method not allowed: ${req.method ?? ''}` })
      return false
    }
    return true
  }

  return [
    {
      kind: 'exact',
      path: `${BRIDGE_PREFIX}/describe`,
      handler: async (req, res) => {
        if (!guard(req, res)) return
        writeJson(res, 200, await handlers.describe())
      },
    },
    {
      kind: 'exact',
      path: `${BRIDGE_PREFIX}/mutate`,
      handler: async (req, res) => {
        if (!guard(req, res)) return
        const body = await readJsonBody(req)
        if (body === undefined) {
          writeJson(res, 400, { ok: false, code: 'settings-rejected', message: 'malformed JSON body' })
          return
        }
        writeJson(res, 200, await handlers.mutate(body))
      },
    },
    {
      kind: 'exact',
      path: `${BRIDGE_PREFIX}/status`,
      handler: async (req, res) => {
        if (!guard(req, res)) return
        writeJson(res, 200, await handlers.status())
      },
    },
    {
      kind: 'exact',
      path: `${BRIDGE_PREFIX}/regenerate`,
      handler: async (req, res) => {
        if (!guard(req, res)) return
        writeJson(res, 200, await handlers.regenerate())
      },
    },
  ]
}

/**
 * Encode `text` into a QR matrix using the vendored encoder (see lib/qrcode.js).
 * Returns the module count and a count×count grid of 0/1 cells the browser
 * renders — nothing is drawn here. The encoder is shipped in-tree so the QR
 * step needs no runtime dependency (a `link:`/`file:` install cannot require a
 * dependency package from inside the checkout).
 */
function qrMatrix(text) {
  return encodeQrMatrix(text)
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
 * same secret that guards the index. Prefix match so both /remote-handoff
 * and /remote-handoff/ reach the handler — the exact match refused the
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
  // Prefix match (not exact) so both /remote-handoff and /remote-handoff/…
  // reach the handler — the webserver's exact match refuses the trailing
  // slash, which phones previously downloaded as a 404 .txt. The handler
  // ignores the pathname and parses the query itself, and no other route
  // begins with /remote-handoff, so the wider match cannot shadow anything.
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
 * @param config - bundle config with `tunnelTarget` already resolved to the upstream.
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
 * Run cloudflared for the fiber's lifetime and publish the QR matrix + link
 * into the `status` store once the random URL appears on stderr. Nothing is
 * printed to the terminal — the browser card reads /status and draws the QR.
 * cloudflared points at the loopback edge proxy (not the harness directly) so
 * tunneled requests arrive fence-clean. Reconnect loops are unnecessary:
 * quick tunnels live for the child's lifetime and the effect dies with the
 * plugin.
 */
async function startTunnel(ctx, config, status, cloudflaredBin) {
  const cp = process.getBuiltinModule('node:child_process')
  const upstream = await startEdgeProxy(config)
  const child = cp.spawn(cloudflaredBin, [
    'tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${String(upstream.port)}`,
  ], { windowsHide: true })

  let published = false

  const publish = async (tunnelUrl) => {
    const token = launchToken(ctx.connection) ?? ''
    const accessUrl = `${tunnelUrl}${HANDOFF_PATH}?token=${encodeURIComponent(token)}`
    // Lazy-load the bundled QR vendor so a tunnel failure never prevents the
    // route tree from mounting. Only the matrix is computed here; the browser
    // renders it inside the Settings card.
    const { count, modules } = await qrMatrix(accessUrl)
    status.state = 'ready'
    status.phase = null
    status.tunnelUrl = tunnelUrl
    status.accessUrl = accessUrl
    status.matrix = { count, modules }
  }

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    const match = TOKEN_RE.exec(chunk)
    if (match !== null && !published) {
      published = true
      void publish(match[0]).catch((err) => {
        status.state = 'failed'
        status.error = err instanceof Error ? err.message : String(err)
        console.error(`qrcode-hassle-free: ${err.message}`)
      })
    }
  })
  child.on('exit', (code) => {
    if (!published) {
      status.state = 'failed'
      status.error = `cloudflared exited early (code ${String(code)}) — no tunnel URL`
    }
  })

  const retry = setTimeout(() => {
    if (!published) {
      status.state = 'failed'
      status.error = 'no tunnel URL after 60s — cloudflared may be offline'
    }
  }, 60_000)

  return () => {
    clearTimeout(retry)
    child.kill()
    upstream.dispose()
  }
}

export const name = 'qrcode-hassle-free'
export const inject = ['webServer', 'connection', 'sessionController']
export { apply, startEdgeProxy, Config }
