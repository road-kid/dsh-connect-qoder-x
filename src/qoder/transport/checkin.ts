/** Qoder campaign inquiry and daily benefit check-in service. */

import type { QoderAuthService } from './auth.ts'
import {
  getQoderCampaignsUrl,
  getQoderClaimCampaignUrl,
  resolveQoderEndpoints,
  type QoderRegion,
} from './endpoints.ts'
import { isQoderAuthRejection, QoderLlmError } from '../errors.ts'
import type { QoderLogger } from './logging.ts'
import { openApiJsonRequest } from './request.ts'
import { qoderDesktopClientType } from './wire/cosy.ts'
import { resolveRiskIdentity, type QoderRiskIdentity } from './risk-identity.ts'

export interface QoderCampaignBenefit {
  kind?: string
  amount?: number
  validity?: {
    mode?: string
    days?: number
  }
}

export interface QoderCampaign {
  campaignId: string
  campaignKey?: string
  actionType: string
  claimStatus: string
  startAt?: number
  endAt?: number
  benefit?: QoderCampaignBenefit
}

export interface QoderCampaignsResponse {
  uid?: string
  claimable?: boolean
  campaigns?: QoderCampaign[]
}

export interface QoderClaimResponse {
  status?: string
  replayed?: boolean
  benefit?: {
    kind?: string
    amount?: number
  }
  expiresAt?: string
}

export interface QoderCheckInResult {
  variantId: string
  date: string
  timestamp: number
  status: 'claimed' | 'already-claimed' | 'no-campaign' | 'error'
  amount?: number | undefined
  campaignKey?: string | undefined
  message?: string | undefined
  /**
   * When the claimed credits expire, epoch milliseconds.
   *
   * A claimed package is not permanent — Qoder grants it for a fixed window
   * (30 days for the daily 100-credit benefit) — and the card has to say so.
   * Resolution order: the claim's own `expiresAt`; failing that, the
   * campaign's stated `validity.days` counted from the claim moment. Absent
   * when the upstream said neither, and an absent value is rendered as
   * unknown rather than guessed.
   */
  expiresAtMs?: number | undefined
  /**
   * A stable reason code for a failed attempt, when one applies.
   *
   * Carried alongside `message` so the card can localize the one failure the
   * user can actually act on — `no-client` means this machine has no Qoder
   * client to mint the device identity the international campaign requires —
   * instead of matching on English prose.
   */
  reasonCode?: 'no-client' | undefined
}

export interface QoderCheckInServiceOptions {
  authService: QoderAuthService
  fetch?: typeof fetch | undefined
  region?: QoderRegion | undefined
  variantId?: string | undefined
  logger?: QoderLogger | undefined
  timeoutMs?: number | undefined
  /**
   * How this machine's risk identity is obtained. Injectable because the real
   * resolver shells out to a signed native binary that only exists where a
   * Qoder client is installed, which no test environment can rely on.
   */
  riskIdentity?: ((region: QoderRegion, uid: string) => Promise<QoderRiskIdentity | undefined>) | undefined
}

const defaultCheckInTimeoutMs = 15_000

/**
 * The identity headers a real desktop client sends, or an empty set.
 *
 * An absent identity is NOT silently equivalent to a present one: the
 * international upstream withholds the daily campaign from a request without
 * it, so the caller distinguishes the two and reports the absence rather than
 * letting it look like "there is no campaign today".
 */
function riskHeaders(identity: QoderRiskIdentity | undefined): Record<string, string> {
  if (identity === undefined) return {}
  return {
    'cosy-machinetoken': identity.machineToken,
    'cosy-machinecode': identity.machineCode,
    'cosy-machinetype': identity.machineType,
  }
}

/**
 * When a claimed package expires, in epoch milliseconds; undefined when the
 * upstream stated neither an absolute moment nor a validity window.
 *
 * Two sources, in order of authority: the claim's own `expiresAt` (an ISO
 * string, what the upstream returns for the grant it just made) and the
 * campaign's `validity.days` counted from the claim. Neither is invented — a
 * plugin that guessed a 30-day window would print a confident wrong date the
 * day Qoder changes its campaign.
 */
export function resolveExpiryMs(
  claimExpiresAt: string | undefined,
  validity: { mode?: string; days?: number } | undefined,
  claimedAtMs: number,
): number | undefined {
  if (typeof claimExpiresAt === 'string' && claimExpiresAt.trim() !== '') {
    const parsed = Date.parse(claimExpiresAt)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  const days = validity?.days
  if (typeof days === 'number' && Number.isFinite(days) && days > 0) {
    return claimedAtMs + days * 24 * 60 * 60 * 1000
  }
  return undefined
}

export class QoderCheckInService {
  private readonly authService: QoderAuthService
  private readonly fetchImpl: typeof fetch
  private readonly region: QoderRegion
  private readonly variantId: string
  private readonly logger: QoderLogger | undefined
  private readonly timeoutMs: number
  private readonly riskIdentity: (region: QoderRegion, uid: string) => Promise<QoderRiskIdentity | undefined>

  constructor(options: QoderCheckInServiceOptions) {
    this.authService = options.authService
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.region = options.region ?? 'china'
    this.variantId = options.variantId ?? 'qoder'
    this.logger = options.logger
    this.timeoutMs = options.timeoutMs ?? defaultCheckInTimeoutMs
    this.riskIdentity = options.riskIdentity ?? resolveRiskIdentity
  }

  async fetchCampaigns(token: string, signal?: AbortSignal, identity?: QoderRiskIdentity): Promise<QoderCampaign[]> {
    const url = getQoderCampaignsUrl(this.region)
    const data = await openApiJsonRequest<QoderCampaignsResponse>(this.fetchImpl, {
      url,
      token,
      // The campaign family gates on the desktop identifier; the generic one
      // answers 200 with an empty list (see `qoderDesktopClientType`).
      headers: { 'cosy-clienttype': qoderDesktopClientType, ...riskHeaders(identity) },
      signal,
      timeoutMs: this.timeoutMs,
      logger: this.logger,
      operation: 'Campaigns',
      logCategory: 'campaigns.list',
    })
    return Array.isArray(data?.campaigns) ? data.campaigns : []
  }

  async claimCampaign(token: string, campaignId: string, signal?: AbortSignal, identity?: QoderRiskIdentity): Promise<QoderClaimResponse> {
    const url = getQoderClaimCampaignUrl(this.region, campaignId)
    const { openApiUrl } = resolveQoderEndpoints(this.region)
    return openApiJsonRequest<QoderClaimResponse>(this.fetchImpl, {
      url,
      method: 'POST',
      token,
      headers: { origin: openApiUrl, 'cosy-clienttype': qoderDesktopClientType, ...riskHeaders(identity) },
      signal,
      timeoutMs: this.timeoutMs,
      logger: this.logger,
      operation: 'ClaimCampaign',
      logCategory: 'campaigns.claim',
    })
  }

  private getTodayDateString(): string {
    // Standardize date on UTC+8 (Beijing Time), which matches Qoder's 10:00 reset cycle
    const now = new Date()
    const utc8Time = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60_000)
    const y = utc8Time.getFullYear()
    const m = String(utc8Time.getMonth() + 1).padStart(2, '0')
    const d = String(utc8Time.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  async checkIn(pat: string, signal?: AbortSignal): Promise<QoderCheckInResult> {
    const today = this.getTodayDateString()
    const nowMs = Date.now()

    if (!pat || typeof pat !== 'string' || pat.trim() === '') {
      return {
        variantId: this.variantId,
        date: today,
        timestamp: nowMs,
        status: 'error',
        message: 'No PAT available',
      }
    }

    const executeWithToken = async (authToken: string, uid: string): Promise<QoderCheckInResult> => {
      /*
       * The machine identity is resolved BEFORE the campaign list is read, and
       * its absence is reported rather than papered over.
       *
       * Qoder's international service withholds the daily campaign from a
       * request that carries no client-minted machine identity, and answers
       * HTTP 200 with an innocuous list either way. Asking without one would
       * therefore produce `no-campaign` — a claim about the ACCOUNT that is
       * really a statement about this process. Only the international region
       * gates on it; the China region ignores it entirely, so a machine
       * without a client installed keeps working there.
       */
      const identity = await this.riskIdentity(this.region, uid)
      if (identity === undefined && this.region === 'global') {
        return {
          variantId: this.variantId,
          date: today,
          timestamp: nowMs,
          status: 'error',
          reasonCode: 'no-client',
          message: 'No Qoder desktop client found on this machine, so the daily campaign cannot be requested. Install Qoder (international) and retry.',
        }
      }
      const campaigns = await this.fetchCampaigns(authToken, signal, identity)
      // Look for daily benefit campaign (actionType === 'CLAIM_BENEFIT')
      const benefitCampaign = campaigns.find(c => c.actionType === 'CLAIM_BENEFIT')
      if (!benefitCampaign) {
        return {
          variantId: this.variantId,
          date: today,
          timestamp: nowMs,
          status: 'no-campaign',
          message: 'No claimable benefit campaign found for this region',
        }
      }

      if (benefitCampaign.claimStatus === 'CLAIMED') {
        const expiresAtMs = resolveExpiryMs(undefined, benefitCampaign.benefit?.validity, nowMs)
        return {
          variantId: this.variantId,
          date: today,
          timestamp: nowMs,
          status: 'already-claimed',
          campaignKey: benefitCampaign.campaignKey,
          amount: benefitCampaign.benefit?.amount ?? 100,
          message: 'Already claimed today',
          ...expiresAtMs === undefined ? {} : { expiresAtMs },
        }
      }

      // Claim it
      const claimResult = await this.claimCampaign(authToken, benefitCampaign.campaignId, signal, identity)
      const isClaimed = claimResult.status === 'CLAIMED'
      const replayed = Boolean(claimResult.replayed)
      const amount = claimResult.benefit?.amount ?? benefitCampaign.benefit?.amount ?? 100

      if (isClaimed) {
        const expiresAtMs = resolveExpiryMs(claimResult.expiresAt, benefitCampaign.benefit?.validity, nowMs)
        return {
          variantId: this.variantId,
          date: today,
          timestamp: nowMs,
          status: replayed ? 'already-claimed' : 'claimed',
          amount,
          campaignKey: benefitCampaign.campaignKey,
          message: replayed ? 'Already claimed today' : `Successfully claimed ${amount} credits`,
          ...expiresAtMs === undefined ? {} : { expiresAtMs },
        }
      }

      return {
        variantId: this.variantId,
        date: today,
        timestamp: nowMs,
        status: 'error',
        campaignKey: benefitCampaign.campaignKey,
        message: `Claim returned status ${claimResult.status ?? 'unknown'}`,
      }
    }

    try {
      const creds = await this.authService.getCredentials(pat, signal)
      try {
        return await executeWithToken(creds.authToken, creds.userID)
      } catch (innerError) {
        // If 401 token rejection, attempt one fresh token rotation and retry
        if (isQoderAuthRejection(innerError)) {
          this.logger?.warn?.(`[Qoder CheckIn] Auth token rejected, retrying with fresh exchange`)
          const freshCreds = await this.authService.exchangeFresh(pat, signal)
          return await executeWithToken(freshCreds.authToken, freshCreds.userID)
        }
        throw innerError
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger?.error?.(`[Qoder CheckIn] Check-in failed: ${message}`)
      return {
        variantId: this.variantId,
        date: today,
        timestamp: nowMs,
        status: 'error',
        message,
      }
    }
  }
}
