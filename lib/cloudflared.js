/**
 * cloudflared binary resolution for the dsh-remote-tunnel-easy bundle.
 *
 * The bundle needs a `cloudflared` binary to open a quick tunnel, but the
 * README's "install cloudflared yourself" prerequisite is exactly the hassle
 * this package exists to remove. This module makes it self-contained: on
 * first tunnel start it probes PATH for an existing binary, uses it when
 * present, and otherwise downloads the pinned official Cloudflare binary,
 * verifies its SHA-256, and caches it under the user's cache directory.
 *
 * No npm dependency is added. Download uses `globalThis.fetch` (Node 22's
 * built-in undici), hashing and file I/O use `node:*` builtins, and the macOS
 * `.tgz` is extracted with the system `tar`. The download happens lazily at
 * tunnel start — never at `dsh plugin add` — so the package keeps its
 * "plain ESM, no postinstall" promise and stays installable without build
 * approval.
 *
 * OS/arch support covers the six binary families Cloudflare ships; any other
 * combination throws with an actionable message so the failure is loud, not a
 * hung "starting" state.
 */

import { Readable } from 'node:stream'
import { createWriteStream, createReadStream, mkdirSync, existsSync, chmodSync, rmSync, renameSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'

/** Pinned cloudflared release this bundle downloads when no system binary exists. */
export const CLOUDFLARED_VERSION = '2026.8.2'

const DOWNLOAD_BASE = `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}`

/**
 * Canonical platform+arch → release asset. Keys use process.platform plus
 * process.arch (Standard mapping: 'x64'/'ia32' on win32, 'x64'/'arm64'
 * elsewhere). `archive: true` marks the macOS `.tgz` that must be extracted.
 * Per-asset digests are the GitHub assets-API `digest` values, not the release
 * body checksums (those were observed to disagree for the darwin tarball).
 */
const ASSETS = {
  'win32-x64': { file: 'cloudflared-windows-amd64.exe', archive: false, sha256: 'c29eee2b121f5436a642eed69fd9767da7e7b8c510fa50aaa130337f931357b5' },
  'win32-ia32': { file: 'cloudflared-windows-386.exe', archive: false, sha256: '6acb072357618fa16c53c43e05438ed728aacd47119f1c6c3aa1a668c3299b43' },
  'darwin-x64': { file: 'cloudflared-darwin-amd64.tgz', archive: true, sha256: 'f1727723c586500e2092368ae21871b3df7ddfd2cb097f22d81bee4a9c458bb4' },
  'darwin-arm64': { file: 'cloudflared-darwin-arm64.tgz', archive: true, sha256: '9042c2c5d8b2de78e60f313d5fb31b6c5c1cebde787a3caf1f2c9588084ac442' },
  'linux-x64': { file: 'cloudflared-linux-amd64', archive: false, sha256: 'fcfb02b575a52ca1af2e3267af4e1517bcdeb30ac48c834c69abaed3c0576ad2' },
  'linux-arm64': { file: 'cloudflared-linux-arm64', archive: false, sha256: '7747d94570fb390cf47dcb4f9555c193c6355cda9793f0d878d9049e5d6a7790' },
}

/** Normalize the running platform/arch into one of the ASSETS keys, or null. */
export function platformKey(platform = process.platform, arch = process.arch) {
  if (platform === 'win32' && (arch === 'x64' || arch === 'ia32')) return `win32-${arch}`
  if (platform === 'darwin' && (arch === 'x64' || arch === 'arm64')) return `darwin-${arch}`
  if (platform === 'linux' && (arch === 'x64' || arch === 'arm64')) return `linux-${arch}`
  return null
}

/** Cache directory for downloaded binaries (per-user, outlives the session). */
export function cacheDir() {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
    return join(base, 'dsh-remote-tunnel-easy', 'cloudflared')
  }
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache')
  return join(base, 'dsh-remote-tunnel-easy', 'cloudflared')
}

/** Absolute path of the cached binary for `key`, encoding version so an upgrade re-downloads. */
function cachedBinaryPath(key) {
  const ext = process.platform === 'win32' ? '.exe' : ''
  return join(cacheDir(), `cloudflared-${CLOUDFLARED_VERSION}-${key}${ext}`)
}

/** Probe PATH for an executable named `cloudflared`; resolve undefined when absent. */
function probePath() {
  return new Promise((resolve) => {
    execFile('cloudflared', ['--version'], { windowsHide: true, timeout: 8000 }, (error) => {
      // Any error (ENOENT, non-zero exit, timeout) means "not usable on PATH".
      resolve(error === null ? 'cloudflared' : undefined)
    })
  })
}

/** SHA-256 of a file, hex-encoded, streamed to avoid buffering ~30–55 MB. */
function sha256File(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/** Stream `url` to `dest`; resolves once fully written. */
function download(url, dest) {
  return fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`cloudflared download failed: HTTP ${response.status}`)
    await new Promise((resolve, reject) => {
      const sink = createWriteStream(dest)
      Readable.fromWeb(response.body).pipe(sink)
      sink.on('finish', resolve)
      sink.on('error', reject)
    })
  })
}

/** Extract a macOS `.tgz` with the system tar; `expectName` is the file it looks for. */
function extractTgz(tgzPath, destDir) {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/tar', ['-xzf', tgzPath, '-C', destDir], (error) => {
      if (error) reject(new Error(`cloudflared archive extraction failed: ${error.message}`))
      else resolve()
    })
  })
}

/**
 * Resolve a runnable cloudflared path honoring the bundle's config.
 *
 * Priority:
 *   1. `config.cloudflaredPath` non-empty → use it verbatim (manual override,
 *      never probe or download).
 *   2. A `cloudflared` binary reachable on PATH → use it (no download).
 *   3. A cached download for the pinned version+platform/arch → reuse it.
 *   4. Download the pinned asset, verify its SHA-256, extract if needed, cache it.
 *
 * `onProgress(message)` is invoked during resolution so the Settings card can
 * show "downloading… / verifying… / extracting…" instead of a bare spinner.
 *
 * @returns {Promise<{ path: string, kind: 'override'|'system'|'downloaded' }>}
 */
export async function resolveCloudflared(config, onProgress = () => {}) {
  if (typeof config.cloudflaredPath === 'string' && config.cloudflaredPath !== '') {
    return { path: config.cloudflaredPath, kind: 'override' }
  }

  const system = await probePath()
  if (system !== undefined) return { path: system, kind: 'system' }

  if (config.autoInstallCloudflared === false) {
    throw new Error('cloudflared not found on PATH and auto-install is disabled — install it and set cloudflaredPath')
  }

  const key = platformKey()
  const asset = ASSETS[key]
  if (asset === undefined) {
    const plat = `${process.platform}-${process.arch}`
    throw new Error(`cloudflared has no official binary for ${plat} — install it yourself and set cloudflaredPath`)
  }

  const finalPath = cachedBinaryPath(key)
  if (existsSync(finalPath)) return { path: finalPath, kind: 'downloaded' }

  const dir = dirname(finalPath)
  mkdirSync(dir, { recursive: true })
  // Download into a temp file and only rename on success, so an interrupted or
  // failed fetch never leaves a half-written cached binary that looks valid.
  const work = tmpdir()
  const tmpAsset = join(work, `dsh-remote-tunnel-easy-${asset.file}-${process.pid}`)
  const tmpBin = join(work, `dsh-remote-tunnel-easy-cloudflared-${process.pid}`)

  try {
    onProgress('downloading cloudflared…')
    await download(`${DOWNLOAD_BASE}/${asset.file}`, tmpAsset)

    onProgress('verifying cloudflared…')
    const actual = await sha256File(tmpAsset)
    if (actual !== asset.sha256) {
      throw new Error(`cloudflared checksum mismatch for ${asset.file} (got ${actual.slice(0, 12)}…)`)
    }

    if (asset.archive) {
      onProgress('extracting cloudflared…')
      const extractDir = join(work, `dsh-remote-tunnel-easy-extract-${process.pid}`)
      mkdirSync(extractDir, { recursive: true })
      await extractTgz(tmpAsset, extractDir)
      const extracted = join(extractDir, 'cloudflared')
      if (!existsSync(extracted)) throw new Error('cloudflared archive contained no cloudflared binary')
      chmodSync(extracted, 0o700)
      renameSync(extracted, tmpBin)
      rmSync(extractDir, { recursive: true, force: true })
    } else {
      // Raw binary: lock it down and move it to its final cached name.
      chmodSync(tmpAsset, 0o700)
      renameSync(tmpAsset, tmpBin)
    }

    renameSync(tmpBin, finalPath)
    return { path: finalPath, kind: 'downloaded' }
  } finally {
    rmSync(tmpAsset, { force: true })
    rmSync(tmpBin, { force: true })
  }
}