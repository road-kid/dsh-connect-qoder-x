/** Browser-safe Qoder subscriber account and quota types. */

/**
 * The name Qoder's own API substitutes when an account has none.
 *
 * It is a WIRE placeholder, not an identity: it rides the encrypted cosy
 * payload (`wire/cosy.ts` sends `name`), so it must keep its exact spelling.
 * Nothing that faces the user may repeat it — an account with no name must
 * render as unnamed rather than as a subscriber called "Qoder User".
 */
export const QODER_UNKNOWN_SUBSCRIBER_NAME = 'Qoder User'

export interface QoderSubscriberProfile {
  id: string
  name: string
  email: string
}

export interface QoderQuota {
  total: number
  used: number
  remaining: number
  percentage: number
  unit: string
}

export interface QoderQuotaUsage {
  userQuota?: QoderQuota | undefined
  orgResourcePackage?: QoderQuota | undefined
  /**
   * Credits granted on top of the plan — the daily campaign's 100, for one.
   *
   * A separate bucket upstream reports beside `userQuota`; it carries its own
   * total and remaining, so leaving it out made the card show fewer packages
   * than the account actually holds (two on the web, one here).
   */
  addOnQuota?: QoderQuota | undefined
  totalUsagePercentage?: number | undefined
  isQuotaExceeded?: boolean | undefined
  expiresAt?: string | undefined
  raw?: unknown
}

export interface QoderSubscriberOrganization {
  orgId: string
  orgName: string
  roleName?: string | undefined
  isSuspended?: boolean
  canManageSubscriptions?: boolean
  resourcePackageFeatureEnabled?: boolean
}

export interface QoderSubscriberFeatureAllowed {
  quest?: boolean
  wiki?: boolean
  codeReview?: boolean
}

export interface QoderSubscriberPlan {
  userType: string
  planTierName: string
  planTier?: string
  isPersonalVersion: boolean
  isHighestTier?: boolean
  isRenewed?: boolean
  startDate?: string
  endDate?: string
  organization?: QoderSubscriberOrganization
  featureAllowed?: QoderSubscriberFeatureAllowed
  raw?: unknown
}

export interface QoderSubscriberStatus {
  allowByok: number
  teamAllowByok?: number
  isPrivacyPolicyModifiable?: boolean
  raw?: unknown
}

export interface QoderAccountInfo {
  profile: QoderSubscriberProfile
  usage?: QoderQuotaUsage
  plan?: QoderSubscriberPlan
  status?: QoderSubscriberStatus
  updatedAt: string
}
