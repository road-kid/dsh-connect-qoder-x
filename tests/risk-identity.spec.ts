import { describe, expect, it } from 'vitest'
import { EventEmitter } from 'node:events'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findRuntimeInfoBinary, readClientVersion, resolveRiskIdentity } from '../src/qoder/transport/risk-identity.ts'

/**
 * A stand-in for the client's `runtime-info` helper.
 *
 * The real helper is a signed native binary that fingerprints the machine, so
 * a test cannot use it: it would make the suite depend on an installed Qoder
 * client and on the host's actual hardware. This double reproduces only the
 * CONTRACT the module depends on — argv carries the product selector, the
 * account arrives on stdin, and one JSON line comes back — which is exactly
 * the part the module has to get right.
 */
function fakeSpawn(stdout: string, options: { exitCode?: number; emitNothing?: boolean } = {}) {
  const calls: { args: string[]; stdin: string }[] = []
  const spawnImpl = ((_exe: string, args: string[]) => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
      stdin: { on: () => void; end: (chunk: string) => void }
      exitCode: number | null
      kill: () => void
    }
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.exitCode = null
    child.kill = () => undefined
    let written = ''
    child.stdin = {
      on: () => undefined,
      end: (chunk: string) => { written = chunk },
    }
    calls.push({ args, get stdin() { return written } } as never)
    // Answer on the next tick so the caller has attached its listeners.
    setImmediate(() => {
      if (!options.emitNothing) child.stdout.emit('data', Buffer.from(stdout, 'utf8'))
      child.exitCode = options.exitCode ?? 0
      child.emit('close', options.exitCode ?? 0)
    })
    return child
  }) as never
  return { spawnImpl, calls }
}

/** Build a throwaway install tree holding a fake helper, and return its root. */
function fakeInstall(withBinary: boolean): string {
  const root = mkdtempSync(join(tmpdir(), 'qoder-install-'))
  const umid = join(root, 'resources', 'umid')
  mkdirSync(umid, { recursive: true })
  if (withBinary) writeFileSync(join(umid, 'runtime-info.exe'), 'stub')
  writeFileSync(join(root, 'resources', 'build-manifest.json'), JSON.stringify({ productVersion: '0.4.3' }))
  return root
}

const goodAnswer = JSON.stringify({
  machineToken: 'P1g-real-token-value-long-enough',
  machineCode: '36115b3f76c2a11a17',
  machineType: '60876dbd14eb657b4a',
})

describe('resolveRiskIdentity', () => {
  it('reports the client identity the helper returns', async () => {
    const { spawnImpl, calls } = fakeSpawn(`${goodAnswer}\n`)
    const identity = await resolveRiskIdentity('global', 'uid-1', { spawnImpl })
    expect(identity).toEqual({
      machineToken: 'P1g-real-token-value-long-enough',
      machineCode: '36115b3f76c2a11a17',
      machineType: '60876dbd14eb657b4a',
    })
    // The helper answers about an ACCOUNT, so the uid must be what we send.
    expect(calls[0]?.stdin).toBe('{"account":"uid-1"}\n')
  })

  it('selects the product with the env argument, not the binary', async () => {
    // Measured on an installed client: env 3 mints the international identity
    // and env 0 the China one, from the same binary. Asking with the wrong one
    // is indistinguishable from asking with none.
    const { spawnImpl, calls } = fakeSpawn(`${goodAnswer}\n`)
    await resolveRiskIdentity('global', 'uid-1', { spawnImpl })
    await resolveRiskIdentity('china', 'uid-1', { spawnImpl })
    expect(calls[0]?.args[0]).toBe('3')
    expect(calls[1]?.args[0]).toBe('0')
  })

  it('refuses to ask without an account to fingerprint', async () => {
    const { spawnImpl, calls } = fakeSpawn(`${goodAnswer}\n`)
    expect(await resolveRiskIdentity('global', '   ', { spawnImpl })).toBeUndefined()
    // Nothing may be spawned: an identity is per-account, so there is no
    // meaningful request to make and inventing a uid would fabricate one.
    expect(calls).toHaveLength(0)
  })

  it('answers undefined rather than throwing when the helper misbehaves', async () => {
    for (const stdout of ['not json\n', '{}\n', '{"machineToken":"only-one-field"}\n', '']) {
      const { spawnImpl } = fakeSpawn(stdout)
      await expect(resolveRiskIdentity('global', 'uid-1', { spawnImpl })).resolves.toBeUndefined()
    }
  })

  it('answers undefined when no Qoder client is installed', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'qoder-empty-'))
    try {
      // The roots are injected so this asserts about the fixture rather than
      // about whether the machine running the suite happens to have Qoder.
      expect(findRuntimeInfoBinary({ installRoots: [empty] })).toBeUndefined()
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})

describe('findRuntimeInfoBinary', () => {
  it('prefers the versioned resources directory the launcher actually runs', async () => {
    // 0.3+ keeps the live version under `.qoder-versions/<ver>/resources`, while
    // the top-level `resources` can be a stale leftover from the first install.
    const root = fakeInstall(true)
    try {
      const versioned = join(root, '.qoder-versions', '0.4.3', 'resources', 'umid')
      mkdirSync(versioned, { recursive: true })
      writeFileSync(join(versioned, 'runtime-info.exe'), 'stub')
      // The top-level candidate holds a helper too, so this only passes if the
      // versioned directory is genuinely searched and preferred.
      expect(findRuntimeInfoBinary({ installRoots: [root], platform: 'win32' }))
        .toBe(join(versioned, 'runtime-info.exe'))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('finds the helper under a plain resources directory', async () => {
    const root = fakeInstall(true)
    try {
      expect(findRuntimeInfoBinary({ installRoots: [root], platform: 'win32' }))
        .toBe(join(root, 'resources', 'umid', 'runtime-info.exe'))
      expect(readClientVersion(join(root, 'resources'))).toBe('0.4.3')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('readClientVersion', () => {
  it('reads the client version, and tolerates a missing manifest', async () => {
    const root = fakeInstall(true)
    try {
      expect(readClientVersion(join(root, 'resources'))).toBe('0.4.3')
      expect(readClientVersion(join(root, 'nope'))).toBeUndefined()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
