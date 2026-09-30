/** Qoder status card contributed to Harness Plugin configuration. */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import {
  QODER_AUTH_PATH,
  QODER_GLOBAL_AUTH_PATH,
  QODER_GLOBAL_PROBE_PATH,
  QODER_GLOBAL_STATUS_PATH,
  QODER_PROBE_PATH,
  QODER_STATUS_PATH,
} from '../status-paths.ts'
import type {
  QoderCatalogModelSnapshot,
  QoderCredentialSource,
  QoderWebCatalog,
  QoderWebCredits,
  QoderProbeAction,
  QoderVariantId,
  QoderWebCreditAccount,
  QoderWebStatus,
} from '../status-paths.ts'
import { isQoderWebStatus } from './status-document.ts'
import type { QoderSettingsKey } from './locales.ts'
import { QuotaSettingsContent, type QuotaSection, type QuotaSettingsScope } from './QuotaSettingsCard.tsx'
import {
  noteQuotaSignIn,
  noteQuotaStatus,
  onQuotaSettingsChange,
  quotaSignInState,
} from './quota-settings-store.ts'

/** Localized copy injected by the browser-plugin registration. */
export interface QoderPluginCardInjected {
  t: (key: QoderSettingsKey, params?: Record<string, unknown>) => string
  /** The bound quota settings face, when the host serves one. */
  scope?: QuotaSettingsScope<QuotaSection> | undefined
  /** Sign-in state per variant; a toggle is disabled when its variant is out. */
  signedIn?: () => { cn: boolean; global: boolean }
  /**
   * Which product variant this card instance renders.
   */
  variant?: QoderCardVariant
  /**
   * Whether to render as the unified Qoder card (merging quota settings + CN + Global with tabs).
   */
  unified?: boolean
}

/** The browser-visible half of a variant: identity, routes, and copy keys. */
export interface QoderCardVariant {
  id: QoderVariantId
  /** Locale key for the card title. */
  titleKey: QoderSettingsKey
  /** Locale key for the card intro line. */
  introKey: QoderSettingsKey
  /** Locale key for the not-signed-in hint. */
  signedOutKey: QoderSettingsKey
  /** Locale key for the PAT generation guide above the input. */
  patGuideKey: QoderSettingsKey
  /** Locale key for the PAT input placeholder (names the site to generate at). */
  patPlaceholderKey: QoderSettingsKey
  statusPath: string
  probePath: string
  authPath: string
}

/*
 * The card's icon, embedded as a data URI rather than imported from
 * assets/icon.svg: the client bundle is a browser CJS module with no build-time
 * asset pipeline (tsdown emits it with an inline `__ModuleLoader__.load`
 * wrapper), so a URL import would resolve to nothing at runtime. workbuddy
 * carries its own icon the same way. The SVG is the repository's assets/icon.svg
 * verbatim — a rounded gradient tile with the bolt mark.
 */
const QODER_PLUGIN_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxIiB5PSIxIiB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHJ4PSI4IiBmaWxsPSJ1cmwoI2cpIiAvPjxwYXRoIGQ9Ik0xOS42IDcuNSAxMSAyMGg1LjZsLTEuNCA4LjVMMjQuNSAxNmgtNS42bC43LTguNVoiIGZpbGw9IiNGRkZGRkYiLz48Y2lyY2xlIGN4PSIyNS41IiBjeT0iMjUuNSIgcj0iMy4yIiBmaWxsPSIjNDVEOUU3Ii8+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMTgiIHkxPSIxIiB4Mj0iMTgiIHkyPSIzNSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPjxzdG9wIHN0b3AtY29sb3I9IiM3Q0I3RkYiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMxNDVBRjMiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48L3N2Zz4='

/** China Qoder; the plugin's primary card and default. */
export const QODER_CN_CARD: QoderCardVariant = {
  id: 'qoder',
  titleKey: 'title',
  introKey: 'intro',
  signedOutKey: 'signedOutHint',
  patGuideKey: 'patGuide',
  patPlaceholderKey: 'patPlaceholder',
  statusPath: QODER_STATUS_PATH,
  probePath: QODER_PROBE_PATH,
  authPath: QODER_AUTH_PATH,
}

/** International Qoder Global. */
export const QODER_GLOBAL_CARD: QoderCardVariant = {
  id: 'qoder-global',
  titleKey: 'titleAI',
  introKey: 'introAI',
  signedOutKey: 'signedOutHintAI',
  patGuideKey: 'patGuideAI',
  patPlaceholderKey: 'patPlaceholderAI',
  statusPath: QODER_GLOBAL_STATUS_PATH,
  probePath: QODER_GLOBAL_PROBE_PATH,
  authPath: QODER_GLOBAL_AUTH_PATH,
}

/** Both cards, in display order (China first). */
export const QODER_CARD_VARIANTS: readonly QoderCardVariant[] = [QODER_CN_CARD, QODER_GLOBAL_CARD]
/**
 * Props delivered by the Plugins page's configuration seats.
 *
 * `view` is the owner's contract (`PluginConfigViewProps` in
 * `ui-plugin-manager`): `summary` asks for the one-liner the card list shows and
 * the fallback for a row with no description, `page` asks for the configuration
 * body. On `page` the OWNER already draws the title, icon, and breadcrumb, so
 * this component draws no heading and no disclosure chrome of its own.
 *
 * The slot is named by the seat this component is primarily registered into;
 * the sibling registration (`plugins.bundle.config`) passes the same props.
 */
export type QoderPluginCardProps =
  PropsRuntime<'plugins.row.config'>
  & Partial<QoderPluginCardInjected>

const POLL_INTERVAL_MS = 60_000

/*
 * Styling mirrors the Settings panel's own plugin card (`.YyYd_a_card` in the
 * client bundle) rather than inventing a look: the same tokens, the same
 * geometry, and the same hover/open treatment. The values here are that rule's
 * values, so a card from this plugin sits in the list beside a built-in one
 * without reading as a different kind of object.
 */
/** Hover, matching the built-in card's `:hover`. Inline styles cannot express a pseudo-class. */
/**
 * The page face: the card is no longer collapsible, so it renders in the "open"
 * treatment unconditionally — the tone the built-in card used while expanded.
 */

/**
 * The page body's inner separator. The card is now the whole page, so this rule
 * sits at the top of the body rather than under a disclosure header.
 */

/** The built-in secondary button: transparent, hairline border, 8px radius. */

/**
 * The PAT entry row: the password field takes the row's flexible width, the
 * Save button keeps its own, and the whole block sits inside the card body
 * without a nested box (the same rule the settings rows follow).
 */

/* ---- Collapsible section (settings, check-in log) ---- */

/**
 * Primary action of the inline confirmation and of the PAT save. Fill and text
 * colour come from the theme as a pair: `brand-primary` is a light accent here,
 * so pairing it with a hardcoded white would render white-on-white.
 */

/**
 * The destructive action's tone: solid error fill while confirmed, and a
 * quiet outline before that. Both derive from the error token pair so the
 * theme stays the single source of the colour.
 */

/* ---- Segmented Tab Switcher styles (Figure 1) ---- */


function progressFillStyle(percent: number): CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: '100%',
    borderRadius: 'inherit',
    background: 'var(--dsw-alias-brand-primary, #1677ff)',
  }
}

/**
 * Status dot colour. Takes `'loading'` as well as the document's own states:
 * before the first response the card knows nothing about the account, so it must
 * not borrow the signed-out grey — that would read as "nothing is wrong, nobody
 * is signed in" when the truth is "not read yet".
 */
function dotStyle(status: 'loading' | QoderWebStatus['status']): CSSProperties {
  const color = status === 'signed-in'
    ? 'var(--dsw-alias-state-success-primary, #22a06b)'
    : status === 'error'
      ? 'var(--dsw-alias-state-error-primary, #d92d20)'
      : 'var(--dsw-alias-label-dimmed, #8c8c8c)'
  return { width: 8, height: 8, borderRadius: '50%', flex: '0 0 auto', background: color }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined).format(value)
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
}

/** Date-only formatting for expiries: the day is what a validity window means. */
function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(ms))
}

function formatTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms))
}

function formatCycleReset(time: string): string {
  const parsed = Date.parse(time)
  if (!Number.isNaN(parsed)) return formatTime(parsed)
  return time
}

function patSourceText(source: QoderCredentialSource, t: QoderPluginCardInjected['t']): string {
  if (source === 'env') return t('patSourceEnv')
  if (source === 'cli') return t('patSourceCli')
  return t('patSourceCard')
}

/**
 * One billing package as a labeled progress bar.
 *
 * A package whose allowance the upstream never reported (`size` not positive)
 * has no percentage to state. It must not fall back to 100%: the plugin would be
 * claiming a full quota it knows nothing about, which is the opposite of the
 * honest "remaining N" line printed below it. Unknown size therefore renders the
 * percent slot as unknown copy and an unfilled, indeterminate track.
 */
function CreditBar({ label, remain, size, unlimited, packageEndTime, t }: {
  label: string
  remain: number
  size: number
  unlimited?: boolean | undefined
  packageEndTime?: string | undefined
  t: QoderPluginCardInjected['t']
}): React.ReactNode {
  const expiry = packageEndTime === undefined
    ? null
    : <p className="qdp-rate">{t('quotaExpires')} {formatCycleReset(packageEndTime)}</p>
  if (unlimited === true) {
    const quotaText = t('unlimitedQuota')
    return (
      <div className="qdp-group">
        <div className="qdp-label">
          <span>{label}</span>
          <span>{quotaText}</span>
        </div>
        <div
          className="qdp-track"
          role="progressbar"
          aria-label={label}
          /*
           * "Uncapped" is not "100% remaining", so the range attributes are
           * omitted and no fill is drawn: an uncapped quota has no proportion
           * to state, and a full bar would assert one.
           */
          aria-valuetext={quotaText}
        />
        <p className="qdp-body">{quotaText}</p>
        {expiry}
      </div>
    )
  }
  const sizeKnown = size > 0
  const detail = sizeKnown
    ? t('exactRemaining', { remain: formatNumber(remain), size: formatNumber(size) })
    : t('creditPackageUnknownSize', { remain: formatNumber(remain) })
  const percent = sizeKnown ? (remain / size) * 100 : undefined
  const display = percent === undefined
    ? t('percentUnknown')
    : t('percentRemaining', { percent: formatPercent(percent) })
  return (
    <div className="qdp-group">
      <div className="qdp-label">
        <span>{label}</span>
        <span>{display}</span>
      </div>
      <div
        className="qdp-track"
        role="progressbar"
        aria-label={label}
        /*
         * No numeric value when the size is unknown: the range attributes are
         * omitted so assistive technology reports an indeterminate bar rather
         * than a second, louder repeat of the false 100%.
         */
        {...percent === undefined
          ? { 'aria-valuetext': detail }
          : { 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent }}
      >
        {percent === undefined ? null : <div style={progressFillStyle(percent)} />}
      </div>
      <p className="qdp-body">{detail}</p>
      {expiry}
    </div>
  )
}

/** Largest declared window a model accepts, when it declares alternatives. */
function maxDeclaredWindow(model: QoderCatalogModelSnapshot): number | undefined {
  const windows = model.supportedContextWindows ?? []
  return windows.length > 0 ? Math.max(...windows) : undefined
}

/**
 * Context capacity, listed in full.
 *
 * Every model the upstream reports a capacity for, largest first. A one-line
 * summary with the exceptions on hover was tried and rejected: capacity is
 * reference data you scan by model, and hiding most of it behind a hover made
 * the common case (a model you already have in mind) the hard one to look up.
 *
 * Purely a report of the upstream's own numbers — the middle alternatives the
 * upstream lists between the default and the maximum are display-only (the
 * upstream honours the default and the maximum, nothing between), so the only
 * control is the maximum-window preference below, which flips every eligible
 * model between its default and its largest declared window.
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000 && tokens % 1_000_000 === 0) return `${tokens / 1_000_000}M`
  if (tokens >= 1_000 && tokens % 1_000 === 0) return `${tokens / 1_000}K`
  return String(tokens)
}

/**
 * A credit multiplier, spelled the way Qoder spells it: the number first, then
 * `x` — `0.0x` for a free model, `0.1x`, `0.5x`, `1.4x`.
 *
 * The upstream's own label is `x<n>` (see `normalizeCredits`), but the user
 * reads the rate as a price multiplier ("half price"), and every Qoder surface
 * they compared against prints it after the number. Two decimals are ALWAYS
 * shown, so the free tier reads `0.0x` rather than `0x`: the column then has
 * one decimal width throughout, and `0.0x` says "a rate that happens to be
 * zero" where a bare `0x` reads like a different kind of value.
 */
function formatRate(factor: number): string {
  return `${factor.toFixed(1)}x`
}

/**
 * Model visibility table with individual toggle switches and batch enable/disable controls.
 */
/**
 * 「用量与签到」面板:上半是剩余积分(周期汇总 + 各资源包进度条),分隔线下
 * 是签到状态与动作(立即签到 / 刷新 / 展开日志 / 清除),签到状态直接印在
 * 行内。workbuddy credit-panel 的结构,按本插件的信息密度重排。
 */
function UsageCheckInPanel({ credits, creditsError, checkIn, t, busy, checkingIn, checkInNotice, autoCheckIn, onCheckIn, clearingLogs, logsDisabled, onClearLogs }: {
  credits?: QoderWebCredits | undefined
  creditsError?: string | undefined
  checkIn?: Extract<QoderWebStatus, { status: 'signed-in' }>['checkIn'] | undefined
  t: QoderPluginCardInjected['t']
  busy?: boolean
  checkingIn?: boolean
  checkInNotice?: string | undefined
  /**
   * Whether this variant's AUTOMATIC check-in toggle is on. The scheduler
   * arms a timer for every variant (so a toggle flipped on later still
   * fires), which means `nextRunAt` exists even while the feature is off —
   * showing it then is what made the card promise a run that would not
   * happen. The line is gated on this flag.
   */
  autoCheckIn?: boolean
  onCheckIn: () => void
  /** A clear-logs request is in flight. */
  clearingLogs?: boolean | undefined
  /** No usable credential, so the ledger's clear action cannot run. */
  logsDisabled?: boolean | undefined
  onClearLogs?: (() => void) | undefined
}): React.ReactNode {
  /** Today's claim already happened (the upstream said so, or the log does). */
  const claimedToday = checkIn !== undefined && checkIn.status === 'claimed'
  return (
    /*
     * 不再有外框(需求 1,按 m02352 截图):上一版这里包了一层 qdp-panel,
     * 两个框外面就多出一个「套壳框」。现在最外层就是并列的两个框本身;
     * 错误行和通知不属于任何一个框,平铺在两栏之上/之下。
     */
    <>
      {creditsError === undefined ? null : <p className="qdp-error">{t('creditsError', { message: creditsError })}</p>}
      {/*
       * 两个框并列(需求 4,按 workbuddy 的 credit-panels 排版):
       *   左框 = 领取记录,每行左边日期、右边到期情况,底部一条到期小结;
       *   右框 = 剩余额度,领取按钮紧贴在额度/进度下面,同框。
       * 窄屏由 .qdp-twoUp 的断点回落到单列。
       */}
      <div className="qdp-twoUp">
        <CheckInLedger
          logs={checkIn?.logs}
          t={t}
          {...clearingLogs === undefined ? {} : { clearing: clearingLogs }}
          {...logsDisabled === undefined ? {} : { disabled: logsDisabled }}
          {...onClearLogs === undefined ? {} : { onClear: onClearLogs }}
        />
        <div className="qdp-panel">
          <div className="qdp-panelHead">
            <h3 className="qdp-panelTitle">{t('creditsHeading')}</h3>
          </div>
          {credits === undefined ? null : (
            <>
              {credits.cycleResetTime === undefined ? null : (
                <p className="qdp-panelMeta">{t('cycleResetAt', { time: formatCycleReset(credits.cycleResetTime) })}</p>
              )}
              {/*
               * 「合计：不限额」 was wrong on two counts: the wording reads as a
               * CAUSE (the account is unlimited) when the upstream field says
               * only that this cycle's usage was not capped, and rendering it
               * in the heading slot put a usage reading where the box's own
               * title belongs. A reading that is not a number is stated as
               * 无上限 usage, and only when the upstream actually said so —
               * an absent/NaN percentage is a reading we never got, and
               * calling that "unlimited" invents a fact.
               */}
              <p className="qdp-panelMeta">
                {Number.isFinite(credits.total)
                  ? t('creditsUsed', { percent: formatPercent(credits.total) })
                  : credits.unlimited === true
                    ? t('creditsUsedUnlimited')
                    : t('creditsNoData')}
              </p>
              {credits.accounts
                .filter((account: QoderWebCreditAccount) => account.remain > 0 || account.unlimited === true)
                .map((account, index) => (
                  <CreditBar
                    key={`${account.packageName}-${String(index)}`}
                    label={account.packageName}
                    remain={account.remain}
                    size={account.size}
                    unlimited={account.unlimited}
                    packageEndTime={account.packageEndTime}
                    t={t}
                  />
                ))}
            </>
          )}
          {/*
           * 签到状态行只印「下次自动领取」。
           *
           * 原来这里印 「今日：{state}」,但 state 说的是插件自己的状态机,
           * 用户手动点的签到也会被它写成「今日已自动签到」—— 把用户的操作
           * 说成自动的,是错的。而「今天领过没有」按钮自己已经表达完了:
           * 领过就是灰的。所以状态文本直接去掉,不再用文字复述按钮。
           */}
          {autoCheckIn !== true || checkIn?.nextRunAt === undefined ? null : (
            <p className="qdp-panelMeta">{t('checkInNextRun', { time: formatTime(checkIn.nextRunAt) })}</p>
          )}
          {/*
           * 「立即领取」 is an ACTION: once today's claim is in, re-offering it
           * invites a request the upstream will only refuse. The claimed state
           * disables the button and says so.
           */}
          <button
            type="button"
            className={claimedToday ? 'qdp-btn qdp-claimBtn' : 'qdp-btn qdp-btnPrimary qdp-claimBtn'}
            disabled={busy || checkingIn || claimedToday}
            onClick={onCheckIn}
          >
            {checkingIn ? t('checkInChecking') : claimedToday ? t('checkInClaimedToday') : t('checkInNow')}
          </button>
          {checkInNotice === undefined ? null : <p className="qdp-body">{checkInNotice}</p>}
        </div>
      </div>
    </>
  )
}

/**
 * 「3 天内到期」的统计窗口。30 天有效期的包还剩 20 天才到期,不该出现在
 * 「3 天内到期」里 —— 这里统计的是窗口内真的会作废的笔,不是「所有还没过期的」。
 * workbuddy 的「最近 3 天到期」就是这个读法。
 */
const SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/**
 * 最近的签到记录(BOX):插件内每次签到领取到的资源包、数量与到期时间。
 *
 * 这是原来「签到日志」表格的替代:表格只能证明「点过按钮」,而这里回答的是
 * 用户真正关心的问题 —— 我手上有哪些还没过期的资源包,各自什么时候作废。
 * 因此按「领取时间」倒序列出,并在每行右侧给出该笔的到期日;上游没给有效期
 * 的笔(手动签到)按领取后 30 天补算,不再显示「有效期未知」。
 */
function CheckInLedger({ logs, t, clearing, disabled, onClear }: {
  logs: readonly {
    id: string
    date: string
    timestamp: number
    status: string
    amount?: number | undefined
    expiresAtMs?: number | undefined
  }[] | undefined
  t: QoderPluginCardInjected['t']
  /** A clear request is in flight; the button reads 「正在清空…」. */
  clearing?: boolean | undefined
  /** No usable credential, so the action cannot run. */
  disabled?: boolean | undefined
  onClear?: (() => void) | undefined
}): React.ReactNode {
  const now = Date.now()
  /*
   * 手动在插件里签到的 +100 Credits,上游不回带有效期;活动的口径是领取后
   * 30 天有效,所以按领取时间补算。活动口径变化时改这一个常数即可 —— 不写
   * 进存储,存储里的字段仍然忠实于上游给没给。
   */
  const MANUAL_GRANT_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000
  const effectiveExpiry = (entry: { timestamp: number; expiresAtMs?: number | undefined }): number =>
    entry.expiresAtMs ?? entry.timestamp + MANUAL_GRANT_VALIDITY_MS
  /*
   * 界面能显示几条就显示几条:不再有 7/30 天切换,也不再按时间窗过滤。
   * 台账回答的是「我手上有哪些资源包」,把窗口做成按钮只是把同一个列表切成
   * 两半,用户还得猜哪一半是对的。条数由 CSS 的行高上限决定(见
   * .qdp-ledgerList 的 max-height),多了就滚动 —— 而不是悄悄丢掉。
   */
  const claimed = (logs ?? [])
    // 已领取的记录才入账:no-campaign / error 不是资源包,列出来只会让人以为
    // 领到了什么。
    .filter(entry => entry.status === 'claimed' || entry.status === 'already-claimed')
    .sort((a, b) => b.timestamp - a.timestamp)
  /*
   * 「3 天内到期」只统计在这个窗口内真的会作废的笔 —— 不是「所有还没过期的」。
   * workbuddy 的「最近 3 天到期」就是这个读法:30 天有效期的包还剩 20 天才
   * 到期,它不该出现在「3 天内到期」里。有效期按补算后的口径算(见上),
   * 所以手动签到的包也参与统计。
   */
  const expiringSoon = claimed.filter(entry => {
    const expiry = effectiveExpiry(entry)
    return expiry > now && expiry <= now + SOON_WINDOW_MS
  })
  const expiringSoonTotal = expiringSoon.reduce((sum, entry) => sum + (entry.amount ?? 0), 0)
  return (
    <div className="qdp-panel">
      <div className="qdp-panelHead">
        <h3 className="qdp-panelTitle">{t('ledgerHeading')}</h3>
        {onClear === undefined ? null : (
          /* 清空日志 lives on its own panel head: the ledger rewrite dropped the
             control that used to sit beside the log table, leaving the
             clear-checkin-logs action with no way to reach it. */
          <button
            type="button"
            className="qdp-btn qdp-btnDangerQuiet"
            disabled={disabled === true || clearing === true}
            onClick={onClear}
          >
            {clearing === true ? t('checkInClearing') : t('checkInClear')}
          </button>
        )}
      </div>
      {claimed.length === 0 ? (
        <p className="qdp-panelMeta">{t('ledgerEmpty')}</p>
      ) : (
        <div className="qdp-logList qdp-ledgerList">
          {claimed.map(entry => {
            const expiry = effectiveExpiry(entry)
            const expired = expiry <= now
            return (
              <div key={entry.id} className="qdp-ledgerRow">
                <span className="qdp-ledgerDate">{formatTime(entry.timestamp)}</span>
                <span className="qdp-ledgerAmount">{entry.amount === undefined ? '—' : `+${entry.amount}`}</span>
                <span className={expired ? 'qdp-ledgerExpiry qdp-ledgerExpired' : 'qdp-ledgerExpiry'}>
                  {expired ? t('ledgerExpired') : t('ledgerExpiresAt', { date: formatDate(expiry) })}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {/* 底部到期小结:与上面的记录行用一条分隔线断开,只占 3 行的空间,
          剩下的高度留给上面的记录列表。 */}
      <div className="qdp-ledgerFoot">
        <span className="qdp-panelMeta">{t('ledgerExpiringHeading', { days: 3 })}</span>
        <span className="qdp-ledgerFootValue">{String(expiringSoonTotal)}</span>
      </div>
    </div>
  )
}

/**
 * 「模型」面板:可见性开关与每个模型的上下文容量合并到同一行(原先一个只有
 * 一个复选框的「上下文」tab + 一个纯开关列表),刷新模型按钮挪进本栏头部
 * (原先孤悬在账号行上)。max-window 偏好置于列表上方。
 */
function ModelsPane({ models, disabledModels = [], catalog, t, busy, onSetModelContextWindow, onSetModelsEnabled, onRefreshModels }: {
  models: readonly QoderCatalogModelSnapshot[] | undefined
  disabledModels?: readonly string[] | undefined
  catalog?: QoderWebCatalog | undefined
  t: QoderPluginCardInjected['t']
  busy?: boolean
  onSetModelContextWindow: (model: string, window: number) => void
  onSetModelsEnabled: (models: readonly string[], enabled: boolean) => void
  onRefreshModels: () => void
}): React.ReactNode {
  /*
   * Display order, NOT upstream order.
   *
   * The discovery answer arrives in whatever order the upstream lists it,
   * which put 「Qoder Auto」 second-to-last — an arbitrary place for the
   * default/auto entry a user looks for first. Rather than trusting it, the
   * roster is sorted by a deliberate tier: the auto/default entry first, then
   * the strongest tiers, then the cheap ones, and finally anything the
   * upstream added that this list does not know about (kept, at the end, in
   * upstream order — an unknown entry is still better than a hidden one).
   */
  const MODEL_TIER: readonly string[] = ['auto', 'ultimate', 'performance', 'cmodel', 'efficient', 'lite']
  const tierOf = (id: string): number => {
    const index = MODEL_TIER.indexOf(id)
    return index === -1 ? MODEL_TIER.length : index
  }
  /*
   * The sort key is the model's DEFAULT window, never the effective one.
   *
   * `contextWindow` carries whatever override the user just picked (catalog.ts
   * all(): an override replaces contextWindow outright), so sorting by it moved
   * a row the moment its own chooser changed — the list "乱动" under the cursor
   * the user was aiming at. `defaultContextWindow` is the upstream's own value
   * and is untouched by the override, so the order holds still while windows
   * are edited. Within a tier the wider default leads.
   */
  const capabilityOf = (model: QoderCatalogModelSnapshot): number =>
    model.defaultContextWindow ?? model.contextWindow ?? 0
  const list = [...(models ?? [])].sort((a, b) => {
    const byTier = tierOf(a.id) - tierOf(b.id)
    if (byTier !== 0) return byTier
    const byCapability = capabilityOf(b) - capabilityOf(a)
    // Last resort: the id, so two models with the same tier and window keep a
    // fixed order across renders instead of swapping by array position.
    return byCapability !== 0 ? byCapability : a.id.localeCompare(b.id)
  })
  /*
   * 滑块的横轴是整张列表共用的,不是每行各画一条。
   *
   * 之前 stops 从本行自己的声明档位算出来,于是「只有 200K 一档」的模型
   * 把 200K 铺在自己的轨道上(把手顶到最右),而 [200K,400K,1M] 的行把
   * 同样三档摊开 —— 两行长度一样、刻度却对不齐,同一个 200K 落在不同的
   * 列上,用户没法横向比较。现在按 token 的绝对值取一个全局端点:每行
   * 用同样的像素宽度,刻度出现在 value/axisMax 的比例位置,200K 在所有
   * 行里都停在同一列。
   */
  const axisMax = list.reduce((best, model) => {
    const declaredMax = (model.supportedContextWindows ?? []).reduce((top, value) => (value > top ? value : top), 0)
    const fallback = model.defaultContextWindow ?? model.contextWindow ?? 0
    const rowMax = declaredMax > 0 ? declaredMax : fallback
    return rowMax > best ? rowMax : best
  }, 0)
  /*
   * 每一行画哪些刻度:优先用上游声明过的档位,再补上全局端点 —— 只画本行
   * 档位的话,一档的模型刻度会散落在别处,又多出对不齐的问题;端点补进去
   * 后所有行的关键刻度都落在同一列。最后加上 0 起点,0 是起点不是档位
   * (见下面 stops 的注释),它负责把轨道铺满,拖上去不写任何东西。
   */
  const axisTicks = (declared: readonly number[]): number[] =>
    [...new Set([0, ...declared, axisMax])]
      .filter(value => Number.isFinite(value) && value >= 0 && value <= axisMax)
      .sort((a, b) => a - b)
  return (
    <div className="qdp-list">
      {/* No pane title: the tab strip above already names this pane. The row
          keeps only the catalogue provenance and its refresh control. */}
      <div className="qdp-modelHead">
        <span />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {catalog === undefined ? null : (
            <span className="qdp-modelMeta">
              {catalog.source === 'live' && catalog.fetchedAt !== undefined
                ? t('catalogLive', { time: formatTime(catalog.fetchedAt) })
                : catalog.source === 'saved' && catalog.fetchedAt !== undefined
                  ? t('catalogSaved', { time: formatTime(catalog.fetchedAt) })
                  : t('catalogFallback')}
            </span>
          )}
          <button type="button" className="qdp-btn" disabled={busy} onClick={onRefreshModels}>
            {busy ? t('refreshingModels') : t('refreshModels')}
          </button>
        </div>
      </div>
      {catalog?.error === undefined ? null : <p className="qdp-error">{t('catalogError', { message: catalog.error })}</p>}
      {list.length === 0 ? (
        <p className="qdp-body">{t('modelsNoModels')}</p>
      ) : (
        <>
          {/*
           * 列头(需求 3):横线把工具行与列表分开,线下列出两列的标题 ——
           * 左边是被勾选的模型名,右边是这一行的上下文窗口滑块。没有列头时
           * 右侧那排滑块看不出是什么,只能靠猜。
           */}
          <div className="qdp-modelColumns">
            <span>{t('modelNameColumn')}</span>
            <span>{t('contextHeading')}</span>
          </div>
          <div className="qdp-modelList">
          {list.map(model => {
            const isModelEnabled = !disabledModels.includes(model.id)
            const capacity = model.contextWindow
            /*
             * 滑块只走上游声明过的档位,Qoder 没报过的值一个都不发。
             *
             * stops 升序,而且第 0 位是「起点」而不是档位 —— 起点标 0,
             * 只用来把轨道铺满(否则模型只剩一档时连条都画不出来),
             * 拖到它上面不写任何东西。真实档位从下标 1 起,所以顺序即
             * 档位高低;原先给 select 用的是降序(大的在前),滑块必须
             * 反过来,否则往右拖反而变小。
             */
            /*
             * 刻度按全局横轴取,而不是只取本行的档位。行为上的两处要点:
             *
             * (a) 把手/刻度的位置一律用 value/axisMax 的比例,所以「只有
             *     200K 一档」的模型,把手停在 200K 处而不是顶到最右 ——
             *     最右是 axisMax(1M),它根本没这个档位。
             * (b) 下标仍然保留 0 号起点,但它只用来铺满轨道;起点不可写,
             *     真实档位是 axisTicks 里 >0 的那些。
             *
             * 用户可选的档位仍是「本行声明过的」:轴上多出来的中间刻度只是
             * 让人对齐,不能因为别的行支持 1M 就允许这一行写 1M —— 发出去
             * 的值必须在上游声明列表里,否则等于替上游发明档位。
             */
            const declared = [...new Set(model.supportedContextWindows ?? (capacity !== undefined ? [capacity] : []))].sort((a, b) => a - b)
            const stops = axisTicks(declared)
            const axisSpan = axisMax > 0 ? axisMax : 1
            const ratioOf = (value: number): number => (value / axisSpan) * 100
            const effective = capacity ?? model.defaultContextWindow
            /*
             * 把手停在哪:先看当前值是否正好落在某个刻度上;不在时(上游
             * 改了口径、或旧配置留下裸值)退回最近的一档,只影响「把手画
             * 在哪」,不会因为渲染而回写任何东西 —— 写回只发生在用户真的
             * 拖动之后。
             */
            const nearest = effective === undefined || effective <= 0
              ? 0
              : stops.reduce((best, choice, index) =>
                  Math.abs(choice - effective) < Math.abs(stops[best]! - effective) ? index : best, 0)
            const currentValue = effective === undefined || effective <= 0 ? 0 : stops[nearest] ?? 0
            const currentIndex = stops.indexOf(currentValue)
            // 可写档位:本行声明过的那些,按轴上的下标排列。
            const writable = new Set(declared)
            return (
              <div
                key={model.id}
                className="qdp-modelRow"
                style={{ opacity: isModelEnabled ? 1 : 0.65 }}
              >
                <label className="qdp-modelEnable">
                  <input
                    type="checkbox"
                    checked={isModelEnabled}
                    disabled={busy}
                    onChange={event => { onSetModelsEnabled([model.id], event.currentTarget.checked) }}
                  />
                  <span className="qdp-modelCopy">
                    <span className="qdp-modelName">
                      {model.name}
                      {/*
                       * 积分消耗倍率(需求 2):直接用上游给的数字,格式化成
                       * 「0.5x」这种写法。上游没说倍率时留空 —— 不猜一个
                       * x1,那会把「不知道」说成「基准价」。
                       */}
                      {model.priceFactor === undefined ? null : (
                        <span className="qdp-modelRate">{formatRate(model.priceFactor)}</span>
                      )}
                    </span>
                    <span className="qdp-modelMeta">{model.id}</span>
                  </span>
                </label>
                <span className="qdp-contextPicker">
                  {declared.length > 0 ? (
                    /*
                     * 每个有档位的模型都画轨道 —— 只有一个档位的模型也有条
                     * (把手停在那一档,拖到起点 0 不写任何东西,所以事实上
                     * 不可滑动),不能因为「没得拖」就退化成一行文字:用户
                     * 要的是轨道始终可见,起点把轨道铺满正是为了这个。
                     */
                    <span className="qdp-windowSlider">
                        {/*
                         * 视觉层:轨道 + 已选填充 + 把手。真正的输入是下面那层
                         * 透明的 range input,拖拽、点击定位、方向键都由它接,
                         * 所以键盘可达性和原生行为都保持不变。
                         *
                         * 位置一律按 token 的绝对值占全轴的比例来算(不是按
                         * 下标),这是「所有行的条一样长、同一档在同一列」的
                         * 关键:轨道宽度是每行同样的像素,值决定刻度落在哪。
                         */}
                        <span className="qdp-windowTrack" aria-hidden="true">
                          <span
                            className="qdp-windowFill"
                            style={{ width: `${String(ratioOf(currentValue))}%` }}
                          />
                          <span
                            className="qdp-windowKnob"
                            style={{ left: `${String(ratioOf(currentValue))}%` }}
                          />
                          <input
                            className="qdp-windowInput"
                            type="range"
                            min={0}
                            max={stops.length - 1}
                            step={1}
                            value={currentIndex}
                            disabled={busy}
                            aria-label={`${model.name} ${t('contextHeading')}`}
                            aria-valuetext={currentValue <= 0 ? t('contextHeading') : formatTokens(currentValue)}
                            onChange={event => {
                              // 滑块的取值是轴上下标,但发出去的永远是那一档
                              // 的真实 token 数 —— 上游字段的语义没有变。轴上
                              // 的 0 号是起点、别的行贡献的中间刻度也不是本行
                              // 声明过的档位,这两类都不写任何东西。
                              const index = Number(event.currentTarget.value)
                              const choice = stops[index]
                              if (choice !== undefined && writable.has(choice)) onSetModelContextWindow(model.id, choice)
                            }}
                          />
                        </span>
                        <span className="qdp-windowTicks" aria-hidden="true">
                          {/*
                           * 首尾必定标出,中间最多再标一档,标满会糊成一片。
                           * 0 号是起点,只画刻度线不印数字(需求:从 0 档开始
                           * 显示条,但不显示 0 这个数字)。
                           */}
                          {(() => {
                            /*
                             * 标签只印本行声明过的档位,而且不超过 3 个就全部
                             * 印出来(200K/400K/1M 一档不落 —— 上一版把起点
                             * 也算进「最多三档」,400K 的标签就是这样丢的);
                             * 更多档时才收敛到首、中、尾。轴上由别的行贡献的
                             * 中间刻度不印数字 —— 那不是这一行能选的档位,
                             * 印出来就是在暗示可以选。起点 0 只画刻度线。
                             */
                            const labelled = declared.length <= 3
                              ? new Set(declared)
                              : new Set([declared[0], declared[Math.floor((declared.length - 1) / 2)], declared[declared.length - 1]])
                            return stops.map((choice, index) => (
                              <span
                                key={index}
                                className="qdp-windowTick"
                                style={{ left: `${String(ratioOf(choice))}%` }}
                              >
                                {choice === 0 ? (
                                  <span className="qdp-windowTickMark" />
                                ) : labelled.has(choice) ? (
                                  formatTokens(choice)
                                ) : null}
                              </span>
                            ))
                          })()}
                        </span>
                    </span>
                  ) : capacity !== undefined ? (
                    <span className="qdp-modelMeta">{formatTokens(capacity)}</span>
                  ) : null}
                </span>
              </div>
            )
          })}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Render Qoder PAT state, quota, catalog, and context capacities as the Plugins
 * page's configuration page (or its one-liner, when the owner asks for
 * `summary`).
 *
 * The card is no longer its own disclosure: the Plugins page draws the title,
 * the icon, the breadcrumb, and the row's 「配置」 control, and this component
 * renders only the body. The variant switcher and the tab strip STAY — they are
 * navigation WITHIN the card, not chrome around it.
 */
/**
 * Collapsible section shell for the card body: a quiet header row (title +
 * chevron) that folds its children away. Settings-class content uses it so the
 * page opens on the account instead of on controls; the check-in log, which
 * grows unbounded, folds the same way.
 */
function CardSection({ title, actions, defaultOpen = false, children }: {
  title: string
  /** Header-row controls (e.g. 「立即签到」). Clicking them must NOT fold the
   * section, so they live OUTSIDE the toggle button, to its right. */
  actions?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}): React.ReactNode {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="qdp-section">
      <div className="qdp-sectionHeadRow">
        <button
          type="button"
          aria-expanded={open}
          className="qdp-sectionHead"
          onClick={() => { setOpen(value => !value) }}
        >
          <span className={`qdp-chevron${open ? ' qdp-chevronOpen' : ''}`} aria-hidden="true" />
          <span className="qdp-sectionTitle">{title}</span>
        </button>
        {actions === undefined ? null : <span className="qdp-sectionActions">{actions}</span>}
      </div>
      {open ? <div className="qdp-sectionBody">{children}</div> : null}
    </div>
  )
}

/**
 * The unified card body: usage first, controls folded.
 *
 * Layout, top to bottom (the workbuddy ordering — one level of variant tabs,
 * then that variant's whole surface vertically):
 *
 * 1. account row: status dot, PAT summary, refresh / replace / clear
 * 2. credit panel: per-package bars AND the cycle summary in one block
 * 3. model area: the max-window preference above the visibility list
 * 4. check-in log (collapsed — it grows unbounded)
 * 5. quota sidebar settings (collapsed — rarely touched, and they gated the
 *    account content when they sat on top)
 */
export function QoderPluginCard(props: QoderPluginCardProps) {
  const { t, scope, signedIn, variant, unified, view } = props
  if (t === undefined) throw new Error('Qoder plugin card requires its translation function')

  const isUnified = unified === true
  const liveSignIn = useSyncExternalStore(onQuotaSettingsChange, quotaSignInState)
  /**
   * The automatic check-in toggles, read from the same settings face the
   * settings rows write. The scheduler arms a timer for EVERY variant (so a
   * toggle flipped on later still fires), so `nextRunAt` alone cannot tell
   * 「已安排」 from 「功能没开」 — this flag is what the card gates the
   * 「下次自动领取」 line on.
   *
   * getSnapshot MUST return the same reference between renders unless the
   * store changed: returning `scope.getSnapshot().value` (a fresh object each
   * call) re-renders forever and trips React's maximum-update-depth guard —
   * the exact hazard `stableProject` documents in QuotaSettingsCard. The
   * projection here is a STRING, so identity is stable by construction.
   */
  const settingsSubscribe = useCallback((onStoreChange: () => void) => {
    return scope?.subscribe(onStoreChange) ?? (() => {})
  }, [scope])
  const autoCheckInKey = useSyncExternalStore(settingsSubscribe, () => {
    const value = scope?.getSnapshot().value
    return `${value?.autoCheckInCN === true ? '1' : '0'}${value?.autoCheckInGlobal === true ? '1' : '0'}`
  })
  const autoCheckInCN = autoCheckInKey.startsWith('1')
  const autoCheckInGlobal = autoCheckInKey.endsWith('1')
  const [activeVariantId, setActiveVariantId] = useState<QoderVariantId>('qoder')
  const currentVariant = isUnified
    ? (activeVariantId === 'qoder' ? QODER_CN_CARD : QODER_GLOBAL_CARD)
    : (variant ?? QODER_CN_CARD)

  const [status, setStatus] = useState<QoderWebStatus>()
  const [signedInState, setSignedInState] = useState<boolean>()
  const [readFailure, setReadFailure] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [patDraft, setPatDraft] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [patBusy, setPatBusy] = useState(false)
  const [patError, setPatError] = useState<string>()
  const [patNotice, setPatNotice] = useState<string>()
  const patInput = useRef<HTMLInputElement>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [clearingLogs, setClearingLogs] = useState(false)
  const [checkInNotice, setCheckInNotice] = useState<string>()
  /** 「清除 PAT」的内联确认：点一次进入确认，再点一次才真正清除。 */
  const [confirmingClear, setConfirmingClear] = useState(false)
  /** 底部双栏 tab:「用量与签到」(默认) / 「模型」。 */
  const [pane, setPane] = useState<'usage' | 'models'>('usage')
  /**
   * 每个 variant 的启用勾选(workbuddy 的 tab-switch)。这是客户端意图层:
   * 关掉的 variant 不再轮询/显示其内容;模型通道的开关仍由 disabledModels
   * 决定,这里不写宿主配置。
   */
  const [variantEnabled, setVariantEnabled] = useState<{ cn: boolean; global: boolean }>({ cn: true, global: true })
  const cnEnabled = variantEnabled.cn
  const globalEnabled = variantEnabled.global
  /**
   * 大标题的展开态(workbuddy 的 .dsm-plugin-card-header)。默认展开:这是
   * 设置页的卡片,收起只是让用户把注意力让给别的插件。列表视图(摘要)不
   * 参与,所以初值直接给 true。
   */
  const [headerOpen, setHeaderOpen] = useState(true)
  const mounted = useRef(true)
  const readSeq = useRef(0)
  const manualControllers = useRef(new Set<AbortController>())

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      for (const controller of manualControllers.current) controller.abort()
      manualControllers.current.clear()
    }
  }, [])

  const trackController = useCallback((): AbortController => {
    const controller = new AbortController()
    manualControllers.current.add(controller)
    return controller
  }, [])

  const authKey = status === undefined || status.status === 'error' ? undefined : status.authKey

  const refresh = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    const seq = ++readSeq.current
    const current = (): boolean => mounted.current && signal?.aborted !== true && seq === readSeq.current
    try {
      const response = await fetch(currentVariant.statusPath, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        ...signal === undefined ? {} : { signal },
      })
      const value: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!isQoderWebStatus(value)) throw new Error(t('statusResponseInvalid'))
      if (!current()) return false
      setStatus(value)
      if (value.status === 'signed-in') {
        setSignedInState(true)
        noteQuotaStatus(currentVariant.id, value)
      } else if (value.status === 'signed-out') {
        setSignedInState(false)
        noteQuotaStatus(currentVariant.id, value)
      }
      setReadFailure(undefined)
      return true
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('requestFailed')
      if (current()) {
        setReadFailure(message)
        setStatus(previous => previous === undefined ? { status: 'error', message } : previous)
      }
      return false
    }
  }, [currentVariant.statusPath, t])

  // The card IS the page now: the owner mounts it only while its detail page is
  // open, so there is no `open` flag to gate the first read on. It still reads
  // once per variant switch, and re-reads when the variant changes.
  useEffect(() => {
    setStatus(undefined)
    setSignedInState(undefined)
    setReadFailure(undefined)
    setPatDraft('')
    setReplacing(false)
    setPatError(undefined)
    setPatNotice(undefined)
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => { controller.abort() }
  }, [currentVariant.statusPath, refresh])

  // The 60s poll. Also ungated: a mounted page is a page the user is looking at,
  // which is exactly when the poll is wanted (the tab is hidden only while the
  // user is away, and `refresh` already tolerates a hidden document elsewhere).
  useEffect(() => {
    if (signedInState === false) return
    const controller = new AbortController()
    const timer = window.setInterval(() => { void refresh(controller.signal) }, POLL_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
      controller.abort()
    }
  }, [refresh, signedInState])

  const manualRefresh = async (): Promise<void> => {
    setBusy(true)
    const controller = trackController()
    try {
      await refresh(controller.signal)
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setBusy(false)
    }
  }

  /**
   * Ask the host to re-read the credential and re-fetch this variant's catalog.
   *
   * Shares the probe route's key and guards: it is a write that spends an
   * upstream request, so it does not belong on the read-only status GET. A
   * failure is surfaced through the refreshed document's `catalog.error` rather
   * than thrown away, so the reason survives the round trip.
   */
  const refreshModels = useCallback(async (): Promise<void> => {
    const key = status?.status === 'signed-in' ? status.probeKey : undefined
    if (key === undefined) return
    setBusy(true)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.probePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Qoder-Probe-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'refresh' } satisfies QoderProbeAction),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setReadFailure(error instanceof Error ? error.message : t('requestFailed'))
      }
      manualControllers.current.delete(controller)
      return
    } finally {
      if (mounted.current) setBusy(false)
    }
    try {
      await refresh(controller.signal)
    } finally {
      manualControllers.current.delete(controller)
    }
  }, [currentVariant.probePath, refresh, status, t, trackController])

  const manualCheckIn = useCallback(async (): Promise<void> => {
    const key = status?.status === 'signed-in' ? status.probeKey : undefined
    if (key === undefined) return
    setCheckingIn(true)
    setCheckInNotice(undefined)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.probePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Qoder-Probe-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'checkin' } satisfies QoderProbeAction),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json() as { state?: string; amount?: number; reason?: string }
      if (result.state === 'claimed') {
        setCheckInNotice(t('autoCheckInStatusClaimed', { amount: result.amount ?? 100 }))
      } else if (result.state === 'already-claimed') {
        setCheckInNotice(t('autoCheckInStatusAlready'))
      } else if (result.state === 'no-campaign') {
        setCheckInNotice(t('autoCheckInStatusNoCampaign'))
      } else if (result.reason) {
        setCheckInNotice(t('autoCheckInStatusError', { message: result.reason }))
      }
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setCheckInNotice(error instanceof Error ? error.message : t('requestFailed'))
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setCheckingIn(false)
    }
    try {
      await refresh(controller.signal)
    } finally {
      manualControllers.current.delete(controller)
    }
  }, [currentVariant.probePath, refresh, status, t, trackController])

  const clearCheckInLogs = useCallback(async (): Promise<void> => {
    const key = status?.status === 'signed-in' ? status.probeKey : undefined
    if (key === undefined) return
    setClearingLogs(true)
    setCheckInNotice(undefined)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.probePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Qoder-Probe-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'clear-checkin-logs' } satisfies QoderProbeAction),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setCheckInNotice(error instanceof Error ? error.message : t('requestFailed'))
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setClearingLogs(false)
    }
    try {
      await refresh(controller.signal)
    } finally {
      manualControllers.current.delete(controller)
    }
  }, [currentVariant.probePath, refresh, status, t, trackController])

  /**
   * Run one probe-route control action and refresh the card's state afterwards.
   *
   * The key travels in a header, not the body: it authorizes the write, and
   * the host never accepts a prompt, a sentinel, or a model outside its own
   * catalog from here.
   */
  const control = useCallback(async (action: QoderProbeAction): Promise<void> => {
    const key = status?.status === 'signed-in' ? status.probeKey : undefined
    if (key === undefined) return
    setBusy(true)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.probePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Qoder-Probe-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify(action),
      })
      const value: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const message = typeof value === 'object' && value !== null && 'error' in value
          ? String((value as Record<string, unknown>)['error'])
          : `HTTP ${response.status}`
        throw new Error(message)
      }
      if ((action.action === 'set-maximum-context-window' || action.action === 'set-models-enabled')
        && (typeof value !== 'object' || value === null || (value as Record<string, unknown>)['state'] !== 'updated')) {
        const reason = typeof value === 'object' && value !== null && 'reason' in value
          ? String((value as Record<string, unknown>)['reason'])
          : t('requestFailed')
        throw new Error(reason)
      }
      await refresh(controller.signal)
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setReadFailure(error instanceof Error ? error.message : t('requestFailed'))
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setBusy(false)
    }
  }, [currentVariant.probePath, refresh, status, t, trackController])

  /**
   * Validate and store the pasted PAT (or overwrite the stored one).
   *
   * The PAT route answers both outcomes as 200 with `ok` carrying the verdict —
   * a refused token is an answer, not a transport failure — so the card checks
   * `ok` and translates the stable `qoder_invalid_pat` / `qoder_missing_pat`
   * codes into the re-generate prompt. The route is variant-fixed: the token
   * this card saves can only ever be validated and stored for this product.
   */
  const savePat = useCallback(async (): Promise<void> => {
    const key = authKey
    const pat = patDraft.trim()
    if (key === undefined || pat === '' || patBusy) return
    setPatBusy(true)
    setPatError(undefined)
    setPatNotice(undefined)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.authPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Qoder-Auth-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'save-pat', pat }),
      })
      const value: unknown = await response.json().catch(() => undefined)
      const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
      const detail = typeof record['error'] === 'string' ? record['error'] : `HTTP ${response.status}`
      if (!response.ok) {
        setPatError(t('patSaveFailed', { message: detail }))
        return
      }
      if (record['ok'] !== true) {
        setPatError(detail === 'qoder_invalid_pat' || detail === 'qoder_missing_pat'
          ? t('patInvalid')
          : t('patSaveFailed', { message: detail }))
        return
      }
      setPatDraft('')
      setReplacing(false)
      setPatNotice(t('patSaved'))
      noteQuotaSignIn(currentVariant.id, true)
      await refresh(controller.signal)
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setPatError(t('patSaveFailed', {
          message: error instanceof Error ? error.message : t('requestFailed'),
        }))
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setPatBusy(false)
    }
  }, [authKey, currentVariant.authPath, patBusy, patDraft, refresh, t, trackController])

  /** Remove the stored PAT; the host answer is `{ ok: true }`, then the card re-reads. */
  const clearPat = useCallback(async (): Promise<void> => {
    const key = authKey
    if (key === undefined || patBusy) return
    setPatBusy(true)
    setPatError(undefined)
    setPatNotice(undefined)
    setReplacing(false)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.authPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Qoder-Auth-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'clear' }),
      })
      // Whatever the outcome, the inline confirm has served its purpose.
      setConfirmingClear(false)
      const value: unknown = await response.json().catch(() => undefined)
      const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
      if (!response.ok || record['ok'] !== true) {
        const detail = typeof record['error'] === 'string' ? record['error'] : `HTTP ${response.status}`
        setPatError(t('patSaveFailed', { message: detail }))
        return
      }
      setPatDraft('')
      const signedOutDoc: QoderWebStatus = { status: 'signed-out', authKey: key }
      setStatus(signedOutDoc)
      setSignedInState(false)
      noteQuotaStatus(currentVariant.id, signedOutDoc)
      noteQuotaSignIn(currentVariant.id, false)
      await refresh(controller.signal)
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setPatError(t('patSaveFailed', {
          message: error instanceof Error ? error.message : t('requestFailed'),
        }))
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setPatBusy(false)
    }
  }, [authKey, currentVariant.authPath, patBusy, refresh, t, trackController])

  /**
   * 更换 PAT: open the entry over the signed-in document, pre-cleared and
   * focused. Unlike the removed device-flow switch this needs no sign-out
   * first — saving validates the new token and overwrites the stored one
   * only on success, so a mistyped paste can never strand the working
   * credential.
   */
  const beginReplace = useCallback((): void => {
    setPatDraft('')
    setPatError(undefined)
    setPatNotice(undefined)
    setReplacing(true)
    // The input mounts in this commit; focus it right after it exists.
    requestAnimationFrame(() => { patInput.current?.focus() })
  }, [])

  const patEntry = (): React.ReactNode => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p className="qdp-body">{t(currentVariant.patGuideKey)}</p>
      <div className="qdp-patRow">
        <input
          ref={patInput}
          type="password"
          value={patDraft}
          placeholder={t(currentVariant.patPlaceholderKey)}
          aria-label={t('patHeading')}
          disabled={patBusy}
          onChange={event => { setPatDraft(event.target.value) }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void savePat()
            }
          }}
          className="qdp-patInput"
        />
        <button
          type="button"
          className="qdp-btn qdp-btnPrimary"
          disabled={patBusy || busy || patDraft.trim() === ''}
          onClick={() => { void savePat() }}
        >
          {patBusy ? t('patSaving') : t('patSave')}
        </button>
        {replacing ? (
          <button
            type="button"
            className="qdp-btn"
            disabled={patBusy}
            onClick={() => {
              setReplacing(false)
              setPatDraft('')
              setPatError(undefined)
            }}
          >
            {t('cancel')}
          </button>
        ) : null}
      </div>
      {patError === undefined ? null : <p className="qdp-error">{patError}</p>}
      {patNotice === undefined ? null : <p className="qdp-body">{patNotice}</p>}
    </div>
  )

  // The page's one-liner for the card list. It is ALSO the page's own intro
  // line: the Plugins page draws the title from the package manifest, so the
  // description text has to come from here either way.
  const cardIntro = isUnified ? t('unifiedIntro') : t(currentVariant.introKey)

  /* 大标题的两行文案:统一卡片用统一标题,分体卡片用各自的标题。 */
  const cardTitle = isUnified ? t('unifiedTitle') : t(currentVariant.titleKey)

  const label = status === undefined
    ? t('loading')
    : status.status === 'signed-in'
      ? t('signedIn')
      : status.status === 'error'
        ? t('requestFailed')
        : t('signedOut')

  /* The account box's state line: with a known subscriber name it reads
     「已登录：name」; without one it is the plain signed-in copy. */
  const signedInLabel = status?.status === 'signed-in' && status.pat?.accountName !== undefined
    ? t('accountSignedInAs', { name: status.pat.accountName })
    : label

  const patSummaryLine = (pat: NonNullable<Extract<QoderWebStatus, { status: 'signed-in' }>['pat']>): React.ReactNode => {
    const parts = [
      patSourceText(pat.source, t),
      pat.savedAtMs === undefined ? null : t('patSavedAt', { time: formatTime(pat.savedAtMs) }),
      pat.patTail === undefined ? null : t('patTail', { tail: `****${pat.patTail}` }),
    ].filter(part => part !== null)
    return <p className="qdp-body">{parts.join(' · ')}</p>
  }

  /* The coding plan the credits belong to. The upstream has always answered
     `/api/v2/user/plan` on every account read; nothing consumed it, so a paid
     seat looked exactly like a free one. Dates are formatted through
     `formatCycleReset`, which falls back to the verbatim string rather than
     inventing a date the upstream did not send. */
  const planLine = status?.status === 'signed-in' && status.plan !== undefined
    ? [
      t('planTier', { name: status.plan.planTierName }),
      status.plan.organizationName === undefined ? null : t('planOrganization', { name: status.plan.organizationName }),
      status.plan.endDate === undefined ? null : t('planEndsAt', { date: formatCycleReset(status.plan.endDate) }),
    ].filter(part => part !== null).join(' · ')
    : undefined

  // Derive status dot for the tab switcher
  const reported = signedIn?.()
  const cnSignedIn = reported !== undefined ? reported.cn : liveSignIn.cn
  const globalSignedIn = reported !== undefined ? reported.global : liveSignIn.global
  const cnDotStatus: 'loading' | QoderWebStatus['status'] = isUnified && activeVariantId === 'qoder'
    ? (status === undefined ? 'loading' : status.status)
    : (cnSignedIn ? 'signed-in' : 'signed-out')
  const globalDotStatus: 'loading' | QoderWebStatus['status'] = isUnified && activeVariantId === 'qoder-global'
    ? (status === undefined ? 'loading' : status.status)
    : (globalSignedIn ? 'signed-in' : 'signed-out')

  // The one-liner the card list shows (and the fallback where a row has no
  // description). Rendered without any state read: it is asked for by the list
  // view, where none of this card's controls exist.
  if (view === 'summary') return <>{cardIntro}</>

  return (
    <div
      /* Hover lives in the .qdp-card:hover rule; the open tone is the class
         pair below. No inline border juggling — the CSSOM shorthand pitfall
         the old object comments describe cannot occur in a stylesheet. */
      className={headerOpen ? 'qdp-card qdp-cardOpen' : 'qdp-card'}
    >
      {/*
       * 大标题(workbuddy 的 .dsm-plugin-card-header):整行是一个 button,
       * 图标 + 标题 + 说明在左,展开箭头推到右边;默认展开。箭头是纯 CSS 画的
       * (见 .qdp-cardChevron 的注释),不引宿主图标原语。
       */}
      <button
        type="button"
        className="qdp-cardHeader"
        aria-expanded={headerOpen}
        aria-label={`${headerOpen ? t('cardCollapse') : t('cardExpand')}: ${cardTitle}`}
        onClick={() => { setHeaderOpen(open => !open) }}
      >
        {/* 图标用 data URI 内嵌:客户端 bundle 不能依赖构建期的资源管道,
            与 workbuddy 把图标常量写进 bundle 的做法一致。 */}
        <img className="qdp-cardIcon" src={QODER_PLUGIN_ICON} alt="" aria-hidden="true" />
        <span className="qdp-cardHead">
          <span className="qdp-cardTitle">{cardTitle}</span>
          <span className="qdp-cardDescription">{cardIntro}</span>
        </span>
        <span
          className={headerOpen ? 'qdp-cardChevron qdp-cardChevronOpen' : 'qdp-cardChevron'}
          aria-hidden="true"
        />
      </button>
      {headerOpen ? (
      <div className="qdp-cardBody">
        {isUnified ? (
          <>
            {/* The ONE level of variant tabs. Each tab below owns its whole
                surface; nothing nests inside it (was: these tabs wrapping a
                second 5-tab strip). */}
            <div className="qdp-seg" role="tablist" aria-label="Qoder Version Selection">
              <span className="qdp-segCell">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeVariantId === 'qoder'}
                  className={cnEnabled && activeVariantId === 'qoder' ? 'qdp-segItem qdp-segItemActive' : 'qdp-segItem'}
                  onClick={() => setActiveVariantId('qoder')}
                >
                  <span style={dotStyle(cnDotStatus)} aria-hidden="true" />
                  <span>{t('variantTabCN')}</span>
                </button>
                {/*
                 * workbuddy's per-tab switch: the checkbox decides whether
                 * THIS side is enabled at all — an off side still shows its
                 * tab (to explain why it is quiet) but reads disabled.
                 */}
                <label className="qdp-segSwitch" title={t('variantEnable')}>
                  <input
                    type="checkbox"
                    checked={cnEnabled}
                    onChange={event => { setVariantEnabled(prev => ({ ...prev, cn: event.currentTarget.checked })) }}
                  />
                </label>
              </span>
              <span className="qdp-segCell">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeVariantId === 'qoder-global'}
                  className={globalEnabled && activeVariantId === 'qoder-global' ? 'qdp-segItem qdp-segItemActive' : 'qdp-segItem'}
                  onClick={() => setActiveVariantId('qoder-global')}
                >
                  <span style={dotStyle(globalDotStatus)} aria-hidden="true" />
                  <span>{t('variantTabGlobal')}</span>
                </button>
                <label className="qdp-segSwitch" title={t('variantEnable')}>
                  <input
                    type="checkbox"
                    checked={globalEnabled}
                    onChange={event => { setVariantEnabled(prev => ({ ...prev, global: event.currentTarget.checked })) }}
                  />
                </label>
              </span>
            </div>
          </>
        ) : null}

          {/*
           * The account box (workbuddy's usage-account): signed-in line and
           * its provenance copy on the left, refresh right-aligned inside.
           * Credential management lives in the PAT box BELOW it — the token's
           * identity (account · tail) with a delete action; saving a new
           * token after a delete is the replace flow, so no separate
           * 「更换」 button is needed.
           */}
          <div className="qdp-accountBox">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <div className="qdp-accountState" role="status" aria-busy={status === undefined}>
                <span aria-hidden="true" style={dotStyle(status === undefined ? 'loading' : status.status)} />
                <span>{signedInLabel}</span>
              </div>
              {status?.status !== 'signed-in' || status.pat === undefined ? null : (
                <span className="qdp-accountExpiry">
                  {[patSourceText(status.pat.source, t),
                    status.pat.savedAtMs === undefined ? null : t('patSavedAt', { time: formatTime(status.pat.savedAtMs) }),
                    status.pat.patTail === undefined ? null : t('patTail', { tail: `****${status.pat.patTail}` })].filter(Boolean).join(' · ')}
                </span>
              )}
              {planLine === undefined ? null : <span className="qdp-accountExpiry">{planLine}</span>}
            </div>
            <button type="button" className="qdp-btn" disabled={busy} onClick={() => { void manualRefresh() }}>
              {busy ? t('refreshing') : t('refresh')}
            </button>
          </div>
          {status?.status !== 'signed-in' || status.pat === undefined
            ? null
            : confirmingClear
              ? <div className="qdp-patBox">
                  <span className="qdp-rate">{t('patClearConfirm')}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="qdp-btn qdp-btnDanger" disabled={busy || patBusy} onClick={() => { void clearPat() }}>
                      {patBusy ? t('patClearing') : t('patClearConfirmYes')}
                    </button>
                    <button type="button" className="qdp-btn" disabled={patBusy} onClick={() => { setConfirmingClear(false) }}>
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              : <div className="qdp-patBox">
                  <div className="qdp-patBoxCopy">
                    {/* Same size/weight as the account box's 「已登录」 line —
                        the box is a labelled field, not a caption. */}
                    <span className="qdp-accountState">{t('patBoxLabel')}</span>
                    <span className="qdp-patBoxMeta">
                      {[status.pat.accountName,
                        status.pat.patTail === undefined ? null : t('patTail', { tail: `****${status.pat.patTail}` })].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <button type="button" className="qdp-btn qdp-btnDangerQuiet" disabled={busy || patBusy} onClick={() => { setConfirmingClear(true) }}>
                    {t('patRemove')}
                  </button>
                </div>}
          {readFailure === undefined || signedInState === undefined
            ? null
            : <p className="qdp-error">{t('statusRefreshFailed', { message: readFailure })}</p>}
          {status?.status === 'signed-in'
            ? <>
                {replacing ? patEntry() : null}
                {status.jobTokenRefreshedAt === undefined
                  ? null
                  : <p className="qdp-body">{t('jobTokenRefreshed', { time: formatTime(status.jobTokenRefreshedAt) })}</p>}
                {/*
                 * 用量与签到面板直接跟在 PAT 框下面:这是打开卡片就想看的
                 * 信息,不再藏在 tab 里(上一版它在「用量与签到」面板下,
                 * 与设置一起被 tab 遮住了)。
                 */}
                <UsageCheckInPanel
                  credits={status.credits}
                  creditsError={status.creditsError}
                  checkIn={status.checkIn}
                  autoCheckIn={isUnified
                    ? (activeVariantId === 'qoder' ? autoCheckInCN : autoCheckInGlobal)
                    : (currentVariant.id === 'qoder' ? autoCheckInCN : autoCheckInGlobal)}
                  t={t}
                  busy={busy}
                  checkingIn={checkingIn}
                  checkInNotice={checkInNotice}
                  onCheckIn={() => { void manualCheckIn() }}
                  clearingLogs={clearingLogs}
                  logsDisabled={status.status !== 'signed-in'}
                  onClearLogs={() => { void clearCheckInLogs() }}
                />
                {/*
                 * 「用量与签到 | 模型」双栏:用量面板已上移到 tab 之外(打开
                 * 即见),所以「用量与签到」栏现在只承载侧栏与签到设置(平铺、
                 * 无标题,跟随当前 variant);「模型」栏承载模型与每模型窗口。
                 */}
                <div className="qdp-paneTabs" role="tablist" aria-label={t('paneUsage')}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pane === 'usage'}
                    className={pane === 'usage' ? 'qdp-paneTab qdp-paneTabActive' : 'qdp-paneTab'}
                    onClick={() => { setPane('usage') }}
                  >
                    {t('paneUsage')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pane === 'models'}
                    className={pane === 'models' ? 'qdp-paneTab qdp-paneTabActive' : 'qdp-paneTab'}
                    onClick={() => { setPane('models') }}
                  >
                    {t('paneModels')}
                  </button>
                </div>
                {pane === 'models' ? (
                  <ModelsPane
                    models={status.models}
                    disabledModels={status.disabledModels}
                    catalog={status.catalog}
                    t={t}
                    busy={busy}
                    onSetModelContextWindow={(model, window) => {
                      void control({ action: 'set-model-context-window', model, window })
                    }}
                    onSetModelsEnabled={(models, enabled) => {
                      void control({ action: 'set-models-enabled', models, enabled })
                    }}
                    onRefreshModels={() => { void refreshModels() }}
                  />
                ) : (
                  /*
                   * 侧栏与签到设置:平铺,无标题(去掉「侧栏与签到设置」标题
                   * 行),跟随当前 variant。
                   */
                  <QuotaSettingsContent
                    t={t}
                    scope={scope}
                    signedIn={signedIn}
                    variant={isUnified
                      ? (activeVariantId === 'qoder' ? 'cn' : 'global')
                      : (currentVariant.id === 'qoder' ? 'cn' : 'global')}
                  />
                )}
              </>
            : null}
          {status?.status === 'signed-out'
            ? <>
                <p className={status.reason === undefined ? 'qdp-body' : 'qdp-error'}>
                  {status.reason ?? t(currentVariant.signedOutKey)}
                </p>
                {authKey === undefined ? null : patEntry()}
                {/* No panes while signed out, but the settings still belong to
                    this side: render them flat under the signed-out copy. */}
                <div className="qdp-settingsFlat">
                  <QuotaSettingsContent
                    t={t}
                    scope={scope}
                    signedIn={signedIn}
                    variant={isUnified
                      ? (activeVariantId === 'qoder' ? 'cn' : 'global')
                      : (currentVariant.id === 'qoder' ? 'cn' : 'global')}
                  />
                </div>
              </>
            : null}
          {status?.status === 'error' ? <p className="qdp-error">{status.message}</p> : null}
      </div>
      ) : null}
    </div>
  )
}
