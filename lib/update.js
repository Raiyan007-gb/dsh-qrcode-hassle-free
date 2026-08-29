/**
 * Self-update support for the qrcode-hassle-free bundle.
 *
 * The Settings card gets an "Update" button that upgrades the installed
 * package to the latest registry version without leaving the UI. This module
 * owns the pure, testable parts — locate the owning profile directory, read
 * its dependency spec, compare versions, and run `pnpm add` inside it — while
 * `index.js` owns the loopback route and in-flight mutex. It deliberately
 * runs the SAME operation the CLI recommends (`dsh plugin --profile <name> add
 * qrcode-hassle-free@latest`) rather than inventing a second update path.
 *
 * `pnpm add <name>@latest` (not `pnpm update`) is the correct verb: a fixed
 * dependency was recorded with a caret range, and `pnpm update` only moves
 * within that range, so it could never reach a new minor/major. `pnpm add
 * name@latest` rewrites the spec and installs the newest release. The
 * `dsh`-side reconciliation is a no-op for an already-registered bundle, so
 * running pnpm directly is equivalent.
 *
 * A live update does NOT replace the code already loaded into this process:
 * the running tunnel, bridge, and card keep the old version until `dsh web`
 * restarts. The card reports that honestly after a successful install.
 */

import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

/** Own package name — the dependency key in the profile manifest and on the registry. */
export const PACKAGE_NAME = 'qrcode-hassle-free'

const REGISTRY_BASE = 'https://registry.npmjs.org'
const DSH_HOME_DIR = '.dsh'
const PROFILES_DIR = 'profiles'

/** Largest chunk of pnpm output kept for an error message, in code units. */
const MAX_OUTPUT = 4000

/** Expand `~`, `~/x`, `~\x` against the OS home; any other value passes through. */
function expandTilde(path) {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

/**
 * Resolve the single-root harness home the same way the boot loader does:
 * `$DSH_HOME` when set and non-blank, otherwise `~/.dsh`. Reimplemented (not
 * imported) so the bundle keeps its zero-dependency install.
 * @returns absolute harness home.
 */
export function dshHome() {
  const configured = process.env.DSH_HOME
  return configured !== undefined && configured.trim().length > 0
    ? join(expandTilde(configured))
    : join(homedir(), DSH_HOME_DIR)
}

/** Canonical on-disk path of this module (symlinks resolved), or undefined. */
function ownRealPath() {
  try {
    return realpathSync.native(fileURLToPath(import.meta.url))
  } catch {
    return undefined
  }
}

/**
 * Locate the profile directory that owns this install by scanning
 * `$DSH_HOME/profiles/*` for a `node_modules/qrcode-hassle-free` whose
 * canonical target contains this module's own canonical path. This matches
 * every real install shape — a registry/copy install, pnpm's `.pnpm` virtual
 * store symlink, and a `link:`/`file:` checkout symlink — without depending
 * on `import.meta.url` still carrying the un-resolved node_modules spelling.
 * @param from - own canonical path (defaults to this module's real path).
 * @returns the owning profile directory, or undefined when none matches.
 */
export function locateProfileDir(from = ownRealPath()) {
  if (from === undefined) return undefined
  let entries
  try {
    entries = readdirSync(join(dshHome(), PROFILES_DIR), { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const dir = join(dshHome(), PROFILES_DIR, entry.name)
    let target
    try {
      target = realpathSync.native(join(dir, 'node_modules', PACKAGE_NAME))
    } catch {
      continue
    }
    if (from === target || (from.length > target.length && from.startsWith(target + sep))) return dir
  }
  return undefined
}

/** The dependency spec recorded for this package in `profileDir`, or undefined. */
export function dependencySpec(profileDir) {
  if (profileDir === undefined) return undefined
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
    const spec = manifest?.dependencies?.[PACKAGE_NAME]
    return typeof spec === 'string' ? spec : undefined
  } catch {
    return undefined
  }
}

/**
 * Classify a dependency spec: `local` for the non-registry forms
 * (`link:`/`file:`/`workspace:`/`portal:`, git URLs, relative paths), and
 * `registry` for a bare name or semver range (which is everything else).
 * @returns 'local' | 'registry' | undefined.
 */
export function classifySpec(spec) {
  if (spec === undefined) return undefined
  const value = spec.trim()
  if (/^(?:link|file|workspace|portal):/.test(value)) return 'local'
  if (/^(?:git\+|https?:\/\/|git:|github:|\.{1,2}(?:[/\\]|$))/.test(value)) return 'local'
  return 'registry'
}

/** Read this package's own `version` from package.json, or undefined. */
export function currentVersion() {
  try {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    return typeof manifest.version === 'string' ? manifest.version : undefined
  } catch {
    return undefined
  }
}

/** Parse a `v`-prefixed dotted semver into `[major, minor, patch]`, or undefined. */
function parseVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version).trim())
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])]
}

/**
 * Compare two dotted semver strings on major, minor, patch.
 * @returns -1 | 0 | 1, or undefined when either side is unparseable.
 */
export function compareVersions(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (left === undefined || right === undefined) return undefined
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1
  }
  return 0
}

/** Whether `latest` is strictly newer than `current` (unparseable compares false). */
export function isNewer(latest, current) {
  const order = compareVersions(latest, current)
  return order !== undefined && order > 0
}

/**
 * Fetch the registry's current `dist-tags.latest` version for this package.
 * Uses the abridged `/<name>/latest` endpoint, which returns only the latest
 * version object. Non-2xx, a missing `version`, or a timeout all throw.
 * @param registryBase - origin (defaults to the public npm registry).
 * @returns the latest published version string.
 */
export async function fetchLatestVersion(registryBase = REGISTRY_BASE) {
  const response = await fetch(`${registryBase}/${PACKAGE_NAME}/latest`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`registry ${PACKAGE_NAME}/latest returned HTTP ${response.status}`)
  const body = await response.json()
  if (typeof body?.version !== 'string') throw new Error(`registry ${PACKAGE_NAME}/latest has no version field`)
  return body.version
}

/**
 * Run `pnpm add <spec>` inside `profileDir` — the same operation the CLI
 * performs for `dsh plugin --profile <name> add ...`. Streams stdout/stderr
 * into bounded buffers so failures surface the useful tail, and enforces a
 * timeout so a hung install cannot wedge the in-flight mutex forever.
 * @param profileDir - the profile directory pnpm runs in.
 * @param spec - package@range to install (defaults to `name@latest`).
 * @param options.timeoutMs - kill the child after this many ms.
 * @returns {Promise<{ ok: true, output: string }>}; rejects with the tail.
 */
export function runPnpmAdd(profileDir, spec = `${PACKAGE_NAME}@latest`, { timeoutMs = 300_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['add', spec], {
      cwd: profileDir,
      shell: process.platform === 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    // Bound the retained output regardless of total stream size.
    const keep = (buffer, chunk) => buffer.length < MAX_OUTPUT ? buffer + chunk.toString() : buffer
    child.stdout?.on('data', (chunk) => { stdout = keep(stdout, chunk) })
    child.stderr?.on('data', (chunk) => { stderr = keep(stderr, chunk) })
    const timer = setTimeout(() => child.kill(), timeoutMs)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve({ ok: true, output: stdout })
        return
      }
      const detail = (stderr || stdout || `pnpm exited with code ${String(code)}`).trim()
      reject(new Error(detail.slice(0, MAX_OUTPUT)))
    })
  })
}