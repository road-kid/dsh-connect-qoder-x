/**
 * The year-9999 "no expiry" sentinel, pinned at the layer that can leak it.
 *
 * Observed live on GET /api/v2/quota/usage (2026-09-27): an account with no
 * plan cycle reports `expiresAt: 253402214400000` — exactly
 * 9999-12-31T00:00:00Z in milliseconds, which Asia/Shanghai renders as
 * 「9999年12月31日 08:00」. The value is a perfectly valid date, so every
 * `> 0` check passes it through; the reader must recognise the sentinel on
 * the date level and normalise it to absent, so the card shows「无到期」
 * instead of a fabricated deadline.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { QoderAuthService } from '../../src/qoder/transport/auth.ts'
import { QoderUsageReader } from '../../src/qoder/transport/account-reader.ts'

function readerWith(expiresAt: number): QoderUsageReader {
  const fetchMock = async (input: URL | Request): Promise<Response> => {
    const url = String(input)
    if (url.includes('/jobToken/exchange')) {
      return new Response(JSON.stringify({ token: 'jt-sentinel', expires_in: 3_600_000 }), { status: 200 })
    }
    if (url.includes('/userinfo')) {
      return new Response(JSON.stringify({ id: 'u1', email: 's@qoder.sh', name: 'S' }))
    }
    if (url.includes('/quota/usage')) {
      return new Response(
        JSON.stringify({
          userId: 'u1',
          userType: 'personal_standard',
          totalUsagePercentage: 0,
          isQuotaExceeded: false,
          expiresAt,
          userQuota: { total: 0, used: 0, remaining: 0, percentage: 0, unit: 'credits' },
          addOnQuota: { total: 700, used: 0, remaining: 700, percentage: 0, unit: 'credits' },
        }),
        { status: 200 },
      )
    }
    throw new Error(`unexpected URL: ${url}`)
  }
  const authService = new QoderAuthService({
    fetch: fetchMock as typeof fetch,
    resolveMachineId: () => 'machine-test',
  })
  return new QoderUsageReader({ authService, fetch: fetchMock as typeof fetch, ttlMs: 60_000 })
}

test('reads the year-9999 sentinel (ms) as "no expiry", not a deadline', async () => {
  const account = await readerWith(253402214400000).readAccount('pt-test')
  assert.equal(account.usage?.expiresAt, undefined)
})

test('reads the year-9999 sentinel (s) as "no expiry" too — unit is inferred by magnitude', async () => {
  const account = await readerWith(253402214400).readAccount('pt-test')
  assert.equal(account.usage?.expiresAt, undefined)
})

test('keeps a real expiry verbatim on both units', async () => {
  const ms = await readerWith(1790756471159).readAccount('pt-test')
  assert.equal(ms.usage?.expiresAt, new Date(1790756471159).toISOString())
  // 1790756471 seconds = the same instant, encoded as seconds (sub-second
  // precision does not survive the unit conversion, by design)
  const s = await readerWith(1_790_756_471).readAccount('pt-test')
  assert.equal(s.usage?.expiresAt, new Date(1_790_756_471_000).toISOString())
})
