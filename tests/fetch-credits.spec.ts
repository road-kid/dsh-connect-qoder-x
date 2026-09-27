import { describe, expect, it, vi } from 'vitest'
import { QoderUpstreamClient } from '../src/upstream.ts'
import type { QoderAccountInfo } from '../src/qoder/account.ts'
import type { QoderTransport } from '../src/qoder/transport/index.ts'

/**
 * The credit parse in all its shapes: how `fetchCredits` maps one
 * `readAccount` answer onto the card's `QoderCredits`, and what the expiry
 * fields do. `expiresAt` is the account's cycle boundary: it reaches
 * `cycleResetTime` only. Package rows never borrow it — the live 2026-09-27
 * account showed one year-9999 "no expiry" sentinel copied onto all three
 * rows that way. Rows carry no expiry until the upstream reports a real
 * per-package one (today's `quota/usage` has no such field).
 */

function clientFor(account: QoderAccountInfo | undefined, readAccount?: QoderTransport['readAccount']) {
  const reader = readAccount ?? (vi.fn(async () => {
    if (account === undefined) throw new Error('account scripted absent')
    return account
  }) as never)
  const transport = {
    stream: () => { throw new Error('not used') },
    discoverModels: async () => [],
    readAccount: reader,
  } as unknown as QoderTransport
  return new QoderUpstreamClient({
    region: 'china',
    providerId: 'qoder',
    getPat: async () => 'pt-test',
    transport,
  })
}

function account(usage: QoderAccountInfo['usage']): QoderAccountInfo {
  return {
    profile: { id: 'u1', name: 'Qoder User', email: 'u@example.com' },
    ...(usage === undefined ? {} : { usage }),
    updatedAt: '2026-09-18T00:00:00Z',
  }
}

describe('fetchCredits shapes', () => {
  it('answers an account with no usage as zero credits and no packages', async () => {
    await expect(clientFor(account(undefined)).fetchCredits()).resolves.toEqual({
      total: 0, totalSize: 0, accounts: [],
    })
  })

  it('renders a personal quota as one package row without expiry fields', async () => {
    const credits = await clientFor(account({
      userQuota: { total: 100, used: 25, remaining: 75, percentage: 25, unit: 'credits' },
    })).fetchCredits()
    expect(credits).toEqual({
      total: 25,
      totalSize: 100,
      accounts: [{ packageName: '个人额度', remain: 75, size: 100 }],
    })
  })

  it('appends the organization package; the cycle field rides only cycleResetTime', async () => {
    const credits = await clientFor(account({
      userQuota: { total: 100, used: 30, remaining: 70, percentage: 30, unit: 'credits' },
      orgResourcePackage: { total: 500, used: 100, remaining: 400, percentage: 20, unit: 'credits' },
      totalUsagePercentage: 33,
      isQuotaExceeded: true,
      expiresAt: '2026-10-01T00:00:00Z',
    })).fetchCredits()
    expect(credits.accounts).toEqual([
      { packageName: '个人额度', remain: 70, size: 100 },
      { packageName: '组织资源包', remain: 400, size: 500 },
    ])
    expect(credits.total).toBe(33)
    expect(credits.totalSize).toBe(600)
    expect(credits.cycleResetTime).toBe('2026-10-01T00:00:00Z')
    expect('unlimited' in credits).toBe(false)
  })

  it('reads an uncapped personal allowance as unlimited', async () => {
    const credits = await clientFor(account({
      userQuota: { total: 0, used: 5, remaining: 0, percentage: 0, unit: 'credits' },
      isQuotaExceeded: false,
    })).fetchCredits()
    expect(credits.unlimited).toBe(true)
  })

  it('passes the cycle string through verbatim, even an empty one', async () => {
    // The WorkBuddy parser dropped empty PackageEndTime strings; the Qoder
    // answer has one expiresAt field checked for presence only. Locking the
    // difference so a "cleanup" here is a visible decision, not a silent one.
    const credits = await clientFor(account({
      userQuota: { total: 10, used: 1, remaining: 9, percentage: 10, unit: 'credits' },
      expiresAt: '',
    })).fetchCredits()
    expect(credits.accounts[0]).toEqual({ packageName: '个人额度', remain: 9, size: 10 })
    expect(credits.cycleResetTime).toBe('')
  })

  it('lists bonus credits as their own package beside the plan', async () => {
    // Observed live: the account holds userQuota (300) and addOnQuota (100, the
    // daily campaign's credits). Mapping only the first made the card list one
    // package where the web listed two.
    const credits = await clientFor(account({
      userQuota: { total: 300, used: 0, remaining: 300, percentage: 0.01, unit: 'credits' },
      addOnQuota: { total: 100, used: 0, remaining: 100, percentage: 0, unit: 'credits' },
    })).fetchCredits()
    expect(credits.accounts.map(entry => entry.packageName)).toEqual(['个人额度', '赠送额度'])
    expect(credits.accounts[1]).toMatchObject({ remain: 100, size: 100 })
    // The cycle total now counts every bucket the account holds.
    expect(credits.totalSize).toBe(400)
  })

  it('omits the bonus package entirely when the upstream does not report one', async () => {
    const credits = await clientFor(account({
      userQuota: { total: 300, used: 0, remaining: 300, percentage: 0.01, unit: 'credits' },
    })).fetchCredits()
    expect(credits.accounts.map(entry => entry.packageName)).toEqual(['个人额度'])
  })

  it('always asks the transport for a fresh read', async () => {
    const readAccount = vi.fn(async () => account(undefined))
    await clientFor(undefined, readAccount as never).fetchCredits()
    expect(readAccount).toHaveBeenCalledWith({ force: true })
  })

  it('propagates an upstream failure for the status route to classify', async () => {
    const reader = vi.fn(async () => { throw new Error('AUTH 401') })
    await expect(clientFor(undefined, reader as never).fetchCredits()).rejects.toThrow('AUTH 401')
  })
})
