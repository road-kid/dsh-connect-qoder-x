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
function ContextTable({ models, t, useMaximumContextWindow, disabled, onUseMaximumContextWindow }: {
  models: readonly QoderCatalogModelSnapshot[] | undefined
  t: QoderPluginCardInjected['t']
  useMaximumContextWindow?: boolean
  disabled?: boolean
  onUseMaximumContextWindow?: (enabled: boolean) => void
}): React.ReactNode {
  const known = (models ?? [])
    .filter(model => model.contextWindow !== undefined)
    // Largest first: the big windows are the ones a user reaches for, and the
    // small ones are then easy to spot at the end.
    .sort((a, b) => (b.contextWindow as number) - (a.contextWindow as number))
  const canSelectMaximum = known.some(model => {
    const max = maxDeclaredWindow(model)
    return max !== undefined && max > (model.defaultContextWindow ?? model.contextWindow ?? 0)
  })
  const showPreference = onUseMaximumContextWindow !== undefined && (canSelectMaximum || useMaximumContextWindow === true)
  if (known.length === 0 && !showPreference) return null
  return (
    <div className="qdp-list">
      <h3 className="qdp-h3">{t('contextHeading')}</h3>
      {showPreference && onUseMaximumContextWindow !== undefined ? (
        <label className="qdp-contextPref">
          <input
            type="checkbox"
            checked={useMaximumContextWindow === true}
            disabled={disabled}
            onChange={event => { onUseMaximumContextWindow(event.currentTarget.checked) }}
          />
          <span className="qdp-contextPrefCopy">
            <span>{t('useMaximumContextWindow')}</span>
            <span className="qdp-rate">{t('useMaximumContextWindowHint')}</span>
          </span>
        </label>
      ) : null}
      {known.map(model => {
        const capacity = model.contextWindow as number
        const max = maxDeclaredWindow(model)
        const alternative = max !== undefined && max > capacity ? max : undefined
        return (
          <div key={model.id} className="qdp-label">
            <span>{model.name}</span>
            <span className="qdp-contextPicker">
              <span>{formatTokens(capacity)}</span>
              {alternative !== undefined
                ? <span className="qdp-rate">{t('contextUpTo', { size: formatTokens(alternative) })}</span>
                : model.defaultContextWindow !== undefined && model.defaultContextWindow < capacity
                  ? <span className="qdp-rate">{t('contextDefault', { size: formatTokens(model.defaultContextWindow) })}</span>
                  : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000 && tokens % 1_000_000 === 0) return `${tokens / 1_000_000}M`
  if (tokens >= 1_000 && tokens % 1_000 === 0) return `${tokens / 1_000}K`
  return String(tokens)
}

/**
 * Model visibility table with individual toggle switches and batch enable/disable controls.
 */
function ModelSwitchTable({
  models,
  disabledModels = [],
  t,
  disabled,
  onSetModelsEnabled,
}: {
  models: readonly QoderCatalogModelSnapshot[] | undefined
  disabledModels?: readonly string[] | undefined
  t: QoderPluginCardInjected['t']
  disabled?: boolean | undefined
  onSetModelsEnabled: (models: readonly string[], enabled: boolean) => void
}): React.ReactNode {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const disabledSet = useMemo(() => new Set(disabledModels), [disabledModels])
  const list = useMemo(() => models ?? [], [models])

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
  }, [list, searchQuery])

  const allFilteredSelected = filteredList.length > 0 && filteredList.every(m => selected.has(m.id))
  const toggleSelectAll = (): void => {
    if (allFilteredSelected) {
      const next = new Set(selected)
      for (const m of filteredList) next.delete(m.id)
      setSelected(next)
    } else {
      const next = new Set(selected)
      for (const m of filteredList) next.add(m.id)
      setSelected(next)
    }
  }

  const toggleSelectOne = (id: string): void => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleBatch = (enabled: boolean): void => {
    const targets = Array.from(selected)
    if (targets.length === 0) return
    onSetModelsEnabled(targets, enabled)
    setSelected(new Set())
  }

  if (list.length === 0) {
    return (
      <div className="qdp-list">
        <h3 className="qdp-h3">{t('modelsHeading')}</h3>
        <p className="qdp-body">{t('modelsNoModels')}</p>
      </div>
    )
  }

  return (
    <div className="qdp-list">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 className="qdp-h3">{t('modelsHeading')}</h3>
        <p className="qdp-body">{t('modelsSubtitle')}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          value={searchQuery}
          placeholder={t('modelsSearchPlaceholder')}
          onChange={e => { setSearchQuery(e.currentTarget.value) }}
          className="qdp-patInput"
        />
        {searchQuery ? (
          <button
            type="button"
            className="qdp-btn"
            onClick={() => { setSearchQuery('') }}
          >
            {t('cancel')}
          </button>
        ) : null}
      </div>

      {/*
       * Batch controls live in ONE header row beside the select-all checkbox
       * (was: a second button row competing with it). The count and the two
       * batch actions only render once something is selected.
       */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={allFilteredSelected}
            disabled={disabled || filteredList.length === 0}
            onChange={toggleSelectAll}
          />
          <span>{allFilteredSelected ? t('modelsDeselectAll') : t('modelsSelectAll')}</span>
        </label>
        {selected.size === 0 ? null : (
          <>
            <span className="qdp-rate">
              {t('modelsSelectedCount', { count: selected.size })}
            </span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="qdp-btn"
              disabled={disabled}
              onClick={() => { handleBatch(true) }}
            >
              {t('modelsEnableSelected')}
            </button>
            <button
              type="button"
              className="qdp-btn"
              disabled={disabled}
              onClick={() => { handleBatch(false) }}
            >
              {t('modelsDisableSelected')}
            </button>
          </>
        )}
      </div>

      {filteredList.length === 0 ? (
        <p className="qdp-body">{t('modelsNoMatch', { query: searchQuery.trim() })}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredList.map(model => {
            const isModelEnabled = !disabledSet.has(model.id)
            const isChecked = selected.has(model.id)
            return (
              <div
                key={model.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'var(--dsw-alias-bg-layer-2)',
                  gap: 12,
                  opacity: isModelEnabled ? 1 : 0.65,
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={() => { toggleSelectOne(model.id) }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--dsw-alias-label-primary)' }}>
                      {model.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }}>
                      {model.id}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: disabled ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={isModelEnabled}
                      disabled={disabled}
                      onChange={event => { onSetModelsEnabled([model.id], event.currentTarget.checked) }}
                    />
                    <span style={{ fontSize: 12, color: isModelEnabled ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-tertiary)' }}>
                      {isModelEnabled ? t('modelsEnabled') : t('modelsDisabled')}
                    </span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CheckInLogTable({
  logs = [],
  t,
  onCheckIn,
  onRefresh,
  onClear,
  busy,
  checkingIn,
  clearing,
  disabled,
  notice,
  nextRun,
}: {
  logs?: readonly {
    id: string
    date: string
    timestamp: number
    status: string
    amount?: number | undefined
    message?: string | undefined
  }[] | undefined
  t: QoderPluginCardInjected['t']
  onCheckIn?: () => void
  onRefresh?: () => void
  onClear?: () => void
  busy?: boolean
  checkingIn?: boolean
  clearing?: boolean
  disabled?: boolean
  notice?: string | undefined
  nextRun?: number | undefined
}): React.ReactNode {
  return (
    <div className="qdp-list">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 className="qdp-h3">{t('tabCheckIn')}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="qdp-btn"
            disabled={disabled || busy || checkingIn}
            onClick={onCheckIn}
          >
            {checkingIn ? t('checkInChecking') : t('checkInNow')}
          </button>
          <button
            type="button"
            className="qdp-btn"
            disabled={busy || checkingIn}
            onClick={onRefresh}
          >
            {busy ? t('checkInRefreshing') : t('checkInRefresh')}
          </button>
          <button
            type="button"
            className="qdp-btn"
            disabled={busy || clearing || !logs || logs.length === 0}
            onClick={onClear}
          >
            {clearing ? t('checkInClearing') : t('checkInClear')}
          </button>
        </div>
      </div>
      {notice === undefined ? null : <p className="qdp-body">{notice}</p>}
      {nextRun === undefined ? null : (
        <p className="qdp-body">{t('checkInNextRun', { time: formatTime(nextRun) })}</p>
      )}
      {!logs || logs.length === 0 ? (
        <p className="qdp-body">{t('checkInLogEmpty')}</p>
      ) : (
        <div className="qdp-logList">
          <div className="qdp-checkinHead">
            <span style={{ flex: 2 }}>{t('checkInLogTime')}</span>
            <span style={{ flex: 3 }}>{t('checkInLogResult')}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>{t('checkInLogAmount')}</span>
          </div>
          {logs.map(log => (
            <div key={log.id} className="qdp-checkinRow">
              <span style={{ flex: 2, color: 'var(--dsw-alias-label-secondary)' }}>{formatTime(log.timestamp)}</span>
              <span style={{ flex: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: log.status === 'claimed'
                    ? 'var(--dsw-alias-status-success, #52c41a)'
                    : log.status === 'already-claimed'
                      ? 'var(--dsw-alias-status-info, #1890ff)'
                      : log.status === 'no-campaign'
                        ? 'var(--dsw-alias-label-tertiary, #999)'
                        : 'var(--dsw-alias-status-error, #f5222d)',
                }} />
                <span>
                  {log.status === 'claimed'
                    ? t('autoCheckInStatusClaimed', { amount: log.amount ?? 100 })
                    : log.status === 'already-claimed'
                      ? t('autoCheckInStatusAlready')
                      : log.status === 'no-campaign'
                        ? t('autoCheckInStatusNoCampaign')
                        : t('autoCheckInStatusError', { message: log.message ?? '' })}
                </span>
              </span>
              <span style={{ flex: 1, textAlign: 'right', fontWeight: 600, color: log.amount ? 'var(--dsw-alias-brand-primary)' : 'inherit' }}>
                {log.amount ? `+${log.amount}` : '-'}
              </span>
            </div>
          ))}
        </div>
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

  const label = status === undefined
    ? t('loading')
    : status.status === 'signed-in'
      ? t('signedIn')
      : status.status === 'error'
        ? t('requestFailed')
        : t('signedOut')

  const patSummaryLine = (pat: NonNullable<Extract<QoderWebStatus, { status: 'signed-in' }>['pat']>): React.ReactNode => {
    const parts = [
      patSourceText(pat.source, t),
      pat.savedAtMs === undefined ? null : t('patSavedAt', { time: formatTime(pat.savedAtMs) }),
      pat.patTail === undefined ? null : t('patTail', { tail: `****${pat.patTail}` }),
    ].filter(part => part !== null)
    return <p className="qdp-body">{parts.join(' · ')}</p>
  }

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
      className="qdp-card qdp-cardOpen"
    >
      <div className="qdp-cardBody">
        {isUnified ? (
          <>
            {/* The ONE level of variant tabs. Each tab below owns its whole
                surface; nothing nests inside it (was: these tabs wrapping a
                second 5-tab strip). */}
            <div className="qdp-seg" role="tablist" aria-label="Qoder Version Selection">
              <button
                type="button"
                role="tab"
                aria-selected={activeVariantId === 'qoder'}
                className={activeVariantId === 'qoder' ? 'qdp-segItem qdp-segItemActive' : 'qdp-segItem'}
                onClick={() => setActiveVariantId('qoder')}
              >
                <span style={dotStyle(cnDotStatus)} aria-hidden="true" />
                <span>{t('variantTabCN')}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeVariantId === 'qoder-global'}
                className={activeVariantId === 'qoder-global' ? 'qdp-segItem qdp-segItemActive' : 'qdp-segItem'}
                onClick={() => setActiveVariantId('qoder-global')}
              >
                <span style={dotStyle(globalDotStatus)} aria-hidden="true" />
                <span>{t('variantTabGlobal')}</span>
              </button>
            </div>
          </>
        ) : null}

          <h3 className="qdp-h3">{t('accountHeading')}</h3>
          <div className="qdp-row">
            <div className="qdp-status" role="status" aria-busy={status === undefined}>
              <span aria-hidden="true" style={dotStyle(status === undefined ? 'loading' : status.status)} />
              <span>{label}</span>
            </div>
            <button type="button" className="qdp-btn" disabled={busy} onClick={() => { void manualRefresh() }}>
              {busy ? t('refreshing') : t('refresh')}
            </button>
            {status?.status !== 'signed-in' || status.authKey === undefined
              ? null
              : <>
                  <button type="button" className="qdp-btn qdp-btnPrimary" disabled={busy || patBusy} onClick={beginReplace}>
                    {t('patReplace')}
                  </button>
                  {/*
                   * Clearing the PAT is the one destructive action on this
                   * row: it renders in the danger tone and demands an inline
                   * confirm, instead of sitting next to 「更换」 at the same
                   * visual weight (was: three equally-weighted buttons, one
                   * of which could drop the working credential on a slip).
                   */}
                  {confirmingClear
                    ? <>
                        <span className="qdp-rate">{t('patClearConfirm')}</span>
                        <button type="button" className="qdp-btn qdp-btnDanger" disabled={busy || patBusy} onClick={() => { void clearPat() }}>
                          {patBusy ? t('patClearing') : t('patClearConfirmYes')}
                        </button>
                        <button type="button" className="qdp-btn" disabled={patBusy} onClick={() => { setConfirmingClear(false) }}>
                          {t('cancel')}
                        </button>
                      </>
                    : <button type="button" className="qdp-btn qdp-btnDangerQuiet" disabled={busy || patBusy} onClick={() => { setConfirmingClear(true) }}>
                        {t('patClear')}
                      </button>}
                </>
            }
          </div>
          {readFailure === undefined || signedInState === undefined
            ? null
            : <p className="qdp-error">{t('statusRefreshFailed', { message: readFailure })}</p>}
          {status?.status === 'signed-in'
            ? <>
                {status.pat === undefined ? null : patSummaryLine(status.pat)}
                {replacing ? patEntry() : null}
                {status.jobTokenRefreshedAt === undefined
                  ? null
                  : <p className="qdp-body">{t('jobTokenRefreshed', { time: formatTime(status.jobTokenRefreshedAt) })}</p>}
                {status.catalog === undefined
                  ? null
                  : <div className="qdp-row">
                      <span className="qdp-body">
                        {status.catalog.source === 'live' && status.catalog.fetchedAt !== undefined
                          ? t('catalogLive', { time: formatTime(status.catalog.fetchedAt) })
                          : status.catalog.source === 'saved' && status.catalog.fetchedAt !== undefined
                            ? t('catalogSaved', { time: formatTime(status.catalog.fetchedAt) })
                            : t('catalogFallback')}
                      </span>
                      <button type="button" className="qdp-btn" disabled={busy} onClick={() => { void refreshModels() }}>
                        {busy ? t('refreshingModels') : t('refreshModels')}
                      </button>
                    </div>}
                {status.catalog?.error === undefined
                  ? null
                  : <p className="qdp-error">{t('catalogError', { message: status.catalog.error })}</p>}
                {/*
                 * Credits: the cycle summary AND the per-package bars in one
                 * block (was: summary on a "status" tab, bars on a "details"
                 * tab — the same question split in two).
                 */}
                {status.creditsError === undefined ? null
                  : <p className="qdp-error">{t('creditsError', { message: status.creditsError })}</p>}
                {status.credits === undefined ? null : (
                  <div className="qdp-list">
                    <div className="qdp-row">
                      <h3 className="qdp-h3">{t('creditsHeading')}</h3>
                      <span className="qdp-body">{status.credits.unlimited === true
                        ? t('creditsTotalUnlimited')
                        : t('creditsUsed', { percent: formatPercent(status.credits.total) })}</span>
                    </div>
                    {status.credits.cycleResetTime === undefined ? null : (
                      <p className="qdp-body">
                        {t('cycleResetAt', { time: formatCycleReset(status.credits.cycleResetTime) })}
                      </p>
                    )}
                    {status.credits.accounts
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
                  </div>
                )}
                {/*
                 * Models: the max-window preference rides ABOVE the visibility
                 * list (was: a whole "context" tab whose only control was this
                 * preference — a tab for one checkbox).
                 */}
                <ContextTable
                  models={status.models}
                  t={t}
                  disabled={busy}
                  {...status.useMaximumContextWindow === undefined ? {} : { useMaximumContextWindow: status.useMaximumContextWindow }}
                  onUseMaximumContextWindow={(enabled: boolean) => { void control({ action: 'set-maximum-context-window', enabled }) }}
                />
                <ModelSwitchTable
                  models={status.models}
                  disabledModels={status.disabledModels}
                  t={t}
                  disabled={busy}
                  onSetModelsEnabled={(models, enabled) => {
                    void control({ action: 'set-models-enabled', models, enabled })
                  }}
                />
                {/*
                 * Check-in log: collapsed by default. The action buttons stay
                 * reachable in the section header row, so checking in needs no
                 * expand; the log table only unfolds when there is something
                 * to read.
                 */}
                <CardSection
                  title={t('tabCheckIn')}
                  actions={
                    <>
                      <button type="button" className="qdp-btn" disabled={status.status !== 'signed-in' || busy || checkingIn} onClick={() => { void manualCheckIn() }}>
                        {checkingIn ? t('checkInChecking') : t('checkInNow')}
                      </button>
                      <button type="button" className="qdp-btn" disabled={busy || checkingIn} onClick={() => { void manualRefresh() }}>
                        {busy ? t('checkInRefreshing') : t('checkInRefresh')}
                      </button>
                      <button type="button" className="qdp-btn" disabled={busy || clearingLogs || !status.checkIn?.logs || status.checkIn.logs.length === 0} onClick={() => { void clearCheckInLogs() }}>
                        {clearingLogs ? t('checkInClearing') : t('checkInClear')}
                      </button>
                    </>
                  }
                >
                  <CheckInLogTable
                    logs={status.checkIn?.logs}
                    t={t}
                    busy={busy}
                    checkingIn={checkingIn}
                    clearing={clearingLogs}
                    disabled={status.status !== 'signed-in'}
                    {...checkInNotice === undefined ? {} : { notice: checkInNotice }}
                    {...status.checkIn?.nextRunAt === undefined ? {} : { nextRun: status.checkIn.nextRunAt }}
                    onCheckIn={() => { void manualCheckIn() }}
                    onRefresh={() => { void manualRefresh() }}
                    onClear={() => { void clearCheckInLogs() }}
                  />
                </CardSection>
              </>
            : null}
          {status?.status === 'signed-out'
            ? <>
                <p className={status.reason === undefined ? 'qdp-body' : 'qdp-error'}>
                  {status.reason ?? t(currentVariant.signedOutKey)}
                </p>
                {authKey === undefined ? null : patEntry()}
              </>
            : null}
          {status?.status === 'error' ? <p className="qdp-error">{status.message}</p> : null}
          {/*
           * Quota sidebar settings: last and collapsed. They were the card's
           * FIRST block — seven controls gating the account content below —
           * and they are the least-touched surface the card owns.
           */}
          <CardSection title={t('quotaSettingsHeading')}>
            <QuotaSettingsContent t={t} scope={scope} signedIn={signedIn} />
          </CardSection>
      </div>
    </div>
  )
}
