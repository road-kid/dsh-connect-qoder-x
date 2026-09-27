import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { QODER_CONNECT_VERSION } from '../src/version.ts'

/**
 * Guard the single-source-of-truth version contract:
 * - the build-time define (`__DSH_QODER_VERSION__`, see tsdown.config.ts)
 *   injects package.json's version into src/version.ts;
 * - if that define is ever dropped, version.ts falls back to '0.0.0-dev' and
 *   this test goes red, flagging the regression (and the drift it would cause
 *   in heartbeat / CLI output).
 */
describe('package version sync', () => {
  it('QODER_CONNECT_VERSION matches package.json', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    expect(QODER_CONNECT_VERSION).toBe(pkg.version)
  })

  it('never leaks a build-define fallback marker', () => {
    expect(QODER_CONNECT_VERSION).not.toBe('0.0.0-dev')
  })

  /**
   * The define reads package.json at BUILD time, so a release that bumps the
   * version after building ships artifacts reporting the old one. Skipped on
   * a fresh clone before the first build.
   *
   * The version literal may land in `index.js` or in a shared chunk beside it
   * (rollup decides which, and the chunk's hashed filename changes with the
   * module graph), so every emitted `.js` is scanned rather than one guessed
   * filename. Searching all of them is what keeps this guard meaningful: the
   * assertion is "the shipped artifacts carry this version", not "the bundle
   * was laid out this way".
   */
  it('built lib/ artifacts carry the current version when present', () => {
    const libDir = new URL('../lib/', import.meta.url)
    if (!existsSync(libDir)) return
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    const bundles = readdirSync(libDir).filter(name => name.endsWith('.js'))
    expect(bundles.length, 'no built bundles in lib/ — run the build before this test').toBeGreaterThan(0)
    const declaring = bundles.filter(bundle =>
      readFileSync(new URL(`../lib/${bundle}`, import.meta.url), 'utf8')
        .includes(`QODER_CONNECT_VERSION = "${pkg.version}"`),
    )
    expect(
      declaring,
      `no built bundle declares QODER_CONNECT_VERSION as "${pkg.version}" — rebuild before committing or publishing`,
    ).not.toHaveLength(0)
  })

  /**
   * The browser bundle must register under the PACKAGE NAME, not under a literal
   * copied into the build config.
   *
   * The client module system loads a bundle for a boot-graph row whose id IS the
   * package name, then asserts it registered that id:
   * `client-modules/src/client/system.ts` reports
   * `loaded without registering "<id>" via __ModuleLoader__.load` and throws
   * `could not load "<id>"` when the factory map has no such key. So a bundle
   * registering under any other name is not merely mislabelled — it never
   * activates, and the whole card disappears from the page.
   *
   * This is a real regression this repo shipped: `tsdown.config.ts` carried its
   * own `PLUGIN_ID = 'dsh-qoder-connect'` literal, which the rename left behind
   * while package.json moved on. The config now derives the id from the manifest;
   * this test is what keeps the two from drifting apart again.
   */
  it('built client bundle registers under the package name', () => {
    const libDir = new URL('../lib/', import.meta.url)
    if (!existsSync(libDir)) return
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { name: string }
    const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    const registration = /__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/.exec(client)
    expect(registration, 'lib/client.js declares no __ModuleLoader__.load id').not.toBeNull()
    expect(registration?.[1]).toBe(pkg.name)
  })
})
