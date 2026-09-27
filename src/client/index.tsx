/** Browser half: Qoder account status, quota cards, and plugin settings. */

import { useEffect } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
// The settings domain base owns the `settings.section` slot contract (and the
// 0.1.5-only `ctx.settingsScope` augmentation) — imported for its TYPES only,
// which is what keeps this bundle free of a runtime dependency on either
// version's settings package.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { QoderProbeControl } from './QoderProbeControl.tsx'
import { QODER_CARD_VARIANTS, QoderPluginCard } from './QoderPluginCard.tsx'
import type { QoderPluginCardInjected } from './QoderPluginCard.tsx'
import type { QuotaSection, QuotaSettingsScope } from './QuotaSettingsCard.tsx'
import { OwnQuotaSettingsScope } from './http-settings-scope.ts'
import { QuotaDashboard, SidebarQuotaCard } from './SidebarQuotaCard.tsx'
import type { QuotaDashboardInjected, QuotaDashboardState, QuotaDashboardProps, SidebarQuotaCardInjected, SidebarQuotaCardProps } from './SidebarQuotaCard.tsx'
import { injectQuotaCss } from './quota-styles.ts'
import './quota-slots.ts'
import { setQuotaPollMs, setQuotaToggles, quotaSignInState, quotaPollMs, noteQuotaStatus, quotaStatusIsFresh, variantOfStatusPath } from './quota-settings-store.ts'
import { isQoderWebStatus } from './status-document.ts'
import { en, zh } from './locales.ts'
import type { QoderSettingsKey } from './locales.ts'
import { QODER_GLOBAL_STATUS_PATH, QODER_STATUS_PATH } from '../status-paths.ts'
import type { QoderWebStatus } from '../status-paths.ts'

/** The dashboard face's props are bound directly; no extra key props are needed. */

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Qoder plugin card copy. */
    'settings.qoder': QoderSettingsKey
    /** Shared quota-settings and sidebar-card copy. */
    'panel.qoder-quota': QoderSettingsKey
  }
}

/** Stable browser-plugin name. */
export const name = 'dsh-connect-qoder-x-client'
/**
 * Client services this bundle requires BEFORE it activates.
 *
 * DSH 0.1.2 removed `@deepseek-ai/dsh-client-runtime` (the package that used to
 * hold the browser `ClientContext` alias and the `slots` service). The services
 * this card relies on now come from narrower packages: the `slots` registry
 * moved to `@deepseek-ai/dsh-client-ui-renderer` and `locale` stayed in
 * `@deepseek-ai/dsh-client-locale`. Both are named in the package's
 * `dsh.client.inject` list.
 *
 * NOT declared here: the settings services. `settingsScope` (0.1.5) does not
 * exist at all on 0.1.7 — a static service dependency on it is what left this
 * plugin's client activation pending forever — and `configForms` (0.1.7) does
 * not exist on 0.1.5. Neither is used any more (see `OwnQuotaSettingsScope`),
 * so no callback waits on them either.
 *
 * ALSO NOT declared here: `ui-plugin-manager`. The two plugin-configuration
 * seats this card registers into (`plugins.row.config`, `plugins.bundle.config`)
 * are declared by that package, but the registrations go through
 * `ctx.slots.inject`, which is a CALLBACK on a slot NAME — a deployment that
 * never composes the Plugins page simply never calls back, exactly like the
 * optional services above. A static dependency would instead gate this whole
 * client on a package the plugin does not need to serve models.
 */
// `modelDirectories` reads the active session through `remote.session`.
// Declaring that dependency at the client entry is required by the Desktop
// renderer; without it Cordis rejects `directoryFor()` before this bundle can
// finish registering its contributions.
export const inject = ['slots', 'locale', 'remote', 'remote.session']

/** The status routes per variant id (mirrors the host's locked route table). */
const VARIANT_STATUS: Record<string, string> = {
  qoder: QODER_STATUS_PATH,
  'qoder-global': QODER_GLOBAL_STATUS_PATH,
}

/**
 * The settings namespace the 0.1.5 Host serves this plugin's quota section
 * under — the same namespace the host half registers with
 * `settings.installSection`.
 */
const QUOTA_SETTINGS_NAMESPACE = 'qoder-quota'

/**
 * The profile ROW ID this plugin runs as — the id its own patch declares.
 *
 * `cordis.patch.yml` inserts `- id: llm-qoder-x, name: dsh-connect-qoder-x`, so
 * the Plugins page reports this plugin's row as `llm-qoder-x`. The browser half
 * needs it for exactly one thing: the right half of {@link ROW_CONFIG_KEY}.
 *
 * A profile that composes this bundle under some OTHER id — the package name is
 * what an entry without an explicit id falls back to — would dispatch a key this
 * constant does not match, and the card simply would not appear on that row.
 * There is no partial failure mode: a keyed slot nobody dispatches renders
 * nothing.
 */
const ENTRY_ID = 'llm-qoder-x'

/**
 * The two 0.1.7 seats this card registers into, on the Plugins page.
 *
 * Both are KEYED slots declared by `@deepseek-ai/dsh-client-ui-plugin-manager`
 * (`packages/client/ui-plugin-manager/src/client/slot-contract.ts`) and both
 * receive the same card component; only the key differs:
 *
 *   - `plugins.row.config`, keyed `<package name>#<row id>`, is the PRIMARY seat.
 *     Hitting it is what makes the Plugins page put a 「配置」 control on this
 *     plugin's row, and clicking that opens this card as the row's own page —
 *     the 「插件 → 点插件名 → 展开设置」 path.
 *   - `plugins.bundle.config`, keyed by PACKAGE NAME alone, renders inline on the
 *     package detail page between the description and the row list: the same
 *     card for a reader who opened the package rather than the row.
 *
 * This replaces the `settings.section` container plus the community-private
 * `plugin-settings.item` child that the three connect plugins used to rendezvous
 * in. That rendezvous is gone: the slot is a normal keyed seat, the owner
 * dispatches it, and no sibling plugin has to agree on an id.
 */
const ROW_CONFIG_SLOT = 'plugins.row.config'
const BUNDLE_CONFIG_SLOT = 'plugins.bundle.config'

/**
 * This plugin's package name — the `plugins.bundle.config` key, and the left half
 * of the `plugins.row.config` key.
 */
const PACKAGE_NAME = 'dsh-connect-qoder-x'

/**
 * The complete `plugins.row.config` key.
 *
 * The owner derives it as `` `${pkg.name}#${row.rowId}` `` where `rowId` comes
 * from the id the bundle's patch declares (`plugin-manager/lib/index.js`:
 * `rows.push({ rowId: row.id, ... })`, fed by `composeEntries`), and this
 * plugin's patch inserts its row as `id: llm-qoder-x`. Built from the two
 * constants rather than written as one literal so a rename cannot desync them
 * from {@link ENTRY_ID} and {@link PACKAGE_NAME}.
 */
const ROW_CONFIG_KEY = `${PACKAGE_NAME}#${ENTRY_ID}`

/**
 * Register card copy, the unified Qoder card on both Plugins-page seats, and the
 * sidebar quota cards.
 *
 * The entire body is wrapped so that a DSH slot-API breaking change (for
 * example the rc.6→rc.7 `id`→`key` / `order`→`priority` rename) degrades
 * to a `console.error` instead of throwing into the DSH loader and raising
 * the red "Failed to load plugins" banner. The host provider keeps working:
 * the `qoder` model channel is unaffected, and `dsh-connect-qoder-x
 * status` reports host health via the heartbeat file.
 *
 * NOTE: the try/catch boundary of this function is mirrored (duplicated) in
 * `tests/client-fallback.spec.ts`, because the real client entry imports
 * browser-only DSH packages that cannot load in the Node test environment.
 * That test therefore does not import this function — it replicates its
 * shape. If you change the guarded body or the `console.error` message here,
 * update the mirrored `apply()` in that spec too, or the fallback test will
 * silently diverge from this real implementation.
 */
export function apply(ctx: ClientContext): void {
  try {
    const namespace = 'settings.qoder'
    ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-connect-qoder-x: settings copy')
    const t = ctx.locale.bind(namespace) as QoderPluginCardInjected['t']

    // 1. The quota settings values the card edits, bound to this plugin's OWN
    // settings file. The face is filled in by `adoptQuotaScope` below.
    /**
     * The bound quota settings face, filled in as soon as this plugin's own
     * settings file answers (see {@link OwnQuotaSettingsScope}).
     *
     * It is bound on a STORED fact rather than when the card's inject factory
     * first runs: the factory only executes while the Plugins page renders, so a
     * fresh page load read no toggles and rendered no sidebar card until the user
     * opened that page. The face's subscription mirrors every accepted snapshot
     * (toggles + interval) into the shared store the sidebar cards and the
     * dashboard read; a deployment where the host route never answers never
     * binds, and the sidebar cards stay hidden.
     */
    let quotaScope: QuotaSettingsScope<QuotaSection> | undefined
    const adoptQuotaScope = (scope: QuotaSettingsScope<QuotaSection>): void => {
      quotaScope = scope
      const applySnapshot = (): void => {
        const value = scope.getSnapshot().value
        setQuotaToggles(value?.sidebarQuotaCN === true, value?.sidebarQuotaGlobal === true)
        if (typeof value?.quotaPollMs === 'number') setQuotaPollMs(value.quotaPollMs)
      }
      applySnapshot()
      scope.subscribe(applySnapshot)
    }

    /**
     * The card's inject face. One face serves both seats: the card is the same
     * component either way, and it reads `view` from its PROPS (the owner's
     * contract), not from here.
     */
    const cardFace = (): QoderPluginCardInjected => ({
      t,
      scope: quotaScope,
      signedIn: () => quotaSignInState(),
      unified: true,
    })

    /**
     * Register the unified Qoder card on both Plugins-page configuration seats.
     *
     * Two registrations, one component, keys derived above. They are independent
     * — a deployment that declares only one of the two seats gets the card on
     * that one and simply never calls back for the other — so neither failure
     * can suppress the other.
     */
    const registerCard = (slot: typeof ROW_CONFIG_SLOT | typeof BUNDLE_CONFIG_SLOT, key: string): void => {
      try {
        ctx.slots.inject(slot, () => ctx.slots.register({
          name: slot,
          key,
          inject: cardFace,
        // The slot names are declared structurally in `quota-slots.ts`, where
        // the owner share (`view`) they carry is written out; the component is
        // typed against that same contract.
        } as never, QoderPluginCard as never))
      } catch (error: unknown) {
        console.error(`[dsh-connect-qoder-x] card slot "${slot}" failed to register (host provider unaffected):`, error)
      }
    }
    registerCard(ROW_CONFIG_SLOT, ROW_CONFIG_KEY)
    registerCard(BUNDLE_CONFIG_SLOT, PACKAGE_NAME)

    /**
     * 插件自有配置（`<profile>/.dsh-connect-qoder-x/settings.json`）：两条宿主线的
     * 读写都走宿主半的 settings face，不再经过 settingsScope / configForms。
     *
     * 0.1.7 的 configForms 写入会整树 reconcile + fiber 热重载（每次约
     * 1~1.5 秒，且每次保存都刷新所有客户端镜像）；自有文件写入是本地毫秒级
     * 原子写。卡片注册无条件进行：scope 在启动时载入，迟到也不会漏掉 UI。
     */
    const ownQuotaScope = new OwnQuotaSettingsScope()
    void ownQuotaScope.load()
    adoptQuotaScope(ownQuotaScope as unknown as QuotaSettingsScope<QuotaSection>)

    // Sidebar quota cards + the dashboard they open. Two registrations, one
    // navigation entry — commandcode's pattern: the layout's keyed `main` slot
    // holds the shared dashboard, each footer card selects it on click. The
    // `layout` service is read REFLECTIVELY at click time (never a static
    // inject — ui-layout is not this bundle's dependency), and the footer
    // registration is gated on the layout seam so a profile without
    // `selectPanel` never renders a dead button.
    const QUOTA_PANEL_ID = 'qoder-quota-panel'
    const CONVERSATION_PANEL_ID = 'conversation'
    interface LayoutSelectionSeam {
      selectPanel: (id: string | null) => void
    }

    // ---- dashboard state (module-closure, read by both the face and open()) ----
    const dashboardDocuments: { cn: QoderWebStatus | undefined; global: QoderWebStatus | undefined } = { cn: undefined, global: undefined }
    let dashboardFetchedAt: number | undefined
    let dashboardLoading = false
    let dashboardRequestedPath: string = QODER_STATUS_PATH
    /** Whether the dashboard is the CURRENT center panel (its mount owns this). */
    let quotaPanelOpen = false
    const dashboardListeners = new Set<() => void>()
    /**
     * The observable source the dashboard reads through the inject face's
     * `hooks` compartment. The renderer caches an inject face ONCE per entry
     * and SPREADS it into props — a face getter is read exactly once and
     * frozen, which is why face-carried documents/activePath went stale. The
     * hooks channel survives: `bindInjectSources` converts each hooks member
     * into a `use<Name>` selector hook, and the hook reads the CURRENT
     * snapshot on every render (the same mechanism commandcode's usage store
     * rides).
     *
     * STABILITY CONTRACT: useSyncExternalStore requires getSnapshot() to
     * return the SAME reference between changes — a fresh object per call
     * re-renders forever and React kills the entry (error #185, the same
     * class of crash the settings card's unstable projection caused). So the
     * snapshot is a CACHED object, replaced wholesale by publish(); every
     * mutator builds the next snapshot and publishes exactly once.
     */
    let dashboardSnap: QuotaDashboardState = {
      documents: [undefined, undefined],
      fetchedAt: undefined,
      loading: false,
      activePath: QODER_STATUS_PATH,
    }
    const rebuildSnapshot = (): void => {
      const next: QuotaDashboardState = {
        documents: [dashboardDocuments.cn, dashboardDocuments.global],
        fetchedAt: dashboardFetchedAt,
        loading: dashboardLoading,
        activePath: dashboardRequestedPath,
      }
      // Publish only on an actual change: identity-stable otherwise.
      if (JSON.stringify(next) !== JSON.stringify(dashboardSnap)) {
        dashboardSnap = next
        for (const listener of dashboardListeners) listener()
      }
    }
    const dashboardSource = {
      getSnapshot: (): QuotaDashboardState => dashboardSnap,
      subscribe: (listener: () => void): (() => void) => {
        dashboardListeners.add(listener)
        return () => {
          dashboardListeners.delete(listener)
        }
      },
    }
    const notifyDashboard = (): void => {
      rebuildSnapshot()
    }

    /**
     * Refresh ONE variant's document (the one the panel is showing) — not
     * both. The earlier version fetched both routes on every panel mount, so
     * clicking the CN card also refreshed the Global card's data and timestamp;
     * the user ruled each click refreshes only what it shows.
     *
     * Freshness rule (also the user's): if the shared document for THIS
     * variant is newer than the configured interval, the fetch is SKIPPED —
     * a click shows the cached numbers instead of re-billing upstream. A
     * variant with NO result yet always fetches. A manual Refresh click
     * (force=true) bypasses the freshness check: an explicit user action
     * always re-reads.
     */
    const refreshDashboard = async (options: { force?: boolean } = {}): Promise<void> => {
      if (dashboardLoading) return
      const variantId = variantOfStatusPath(dashboardRequestedPath)
      if (options.force !== true && quotaStatusIsFresh(variantId, quotaPollMs())) return
      dashboardLoading = true
      rebuildSnapshot()
      try {
        const result = await fetchStatusDocument(variantId === 'qoder' ? QODER_STATUS_PATH : QODER_GLOBAL_STATUS_PATH)
        // Publish through the SHARED store: the sidebar cards and the settings
        // toggles read the same documents, so one refresh updates every
        // surface AT WHICH IT IS SHOWN — and only that variant's document.
        if (result !== undefined) noteQuotaStatus(variantId, result)
        dashboardFetchedAt = Date.now()
      } finally {
        dashboardLoading = false
        rebuildSnapshot()
      }
    }

    let dashboardTimer: number | undefined
    const startDashboardPoll = (): void => {
      if (dashboardTimer !== undefined) return
      void refreshDashboard()
      dashboardTimer = window.setInterval(() => {
        if (document.hidden) return
        // Interval ticks honour the freshness rule too: a tick within the
        // interval of the last read is a no-op, not a fetch.
        void refreshDashboard()
      }, Math.max(60_000, quotaPollMs()))
    }
    const stopDashboardPoll = (): void => {
      if (dashboardTimer === undefined) return
      window.clearInterval(dashboardTimer)
      dashboardTimer = undefined
    }

    async function fetchStatusDocument(path: string): Promise<QoderWebStatus | undefined> {
      try {
        const response = await fetch(path, { headers: { accept: 'application/json' } })
        const body: unknown = await response.json()
        return response.ok && isQoderWebStatus(body) ? body : undefined
      } catch {
        return undefined
      }
    }

    // Mount/unmount wrapper. A FUNCTION DECLARATION, defined before the
    // register call that names it: the last build named a `const` from inside
    // the slots.inject factory, which ran synchronously (ui-layout was already
    // live) and hit the temporal dead zone — the ReferenceError was contained
    // by the register's own try/catch, the dashboard cell never registered,
    // and every card click threw "main panel not registered" (the dead
    // button). Hoisted declarations cannot hit the dead zone. The child
    // renders as JSX (not a bare function call) so its hooks stay in their
    // own component instance.
    function QuotaDashboardWithLifecycle(props: QuotaDashboardProps): React.ReactNode {
      useEffect(() => {
        quotaPanelOpen = true
        startDashboardPoll()
        return () => {
          quotaPanelOpen = false
          stopDashboardPoll()
        }
      }, [])
      return <QuotaDashboard {...props} />
    }

    const panelFace = (): QuotaDashboardInjected => ({
      hooks: {
        // Renderer converts this to the `useQuotaDashboard` selector hook
        // (standardHookPropName capitalises the name). Its snapshots MUST be
        // reference-stable between changes — useSyncExternalStore compares
        // identity — so refreshDashboard publishes a fresh top-level object.
        quotaDashboard: dashboardSource,
      },
      t,
      statusPaths: [QODER_STATUS_PATH, QODER_GLOBAL_STATUS_PATH],
      refresh: () => {
        // The dashboard's Refresh button is an explicit user action: it
        // bypasses the freshness rule and re-reads the SHOWN variant only.
        void refreshDashboard({ force: true })
      },
      // The user switched to another variant's tab: point the dashboard at it
      // and fetch that variant when the shared store holds nothing for it (or
      // something stale). Its sidebar card being off means no other surface
      // ever fetched it, so without this the tab showed "save a PAT" until the
      // user toggled a setting.
      onVariantPicked: (path: string) => {
        dashboardRequestedPath = path
        notifyDashboard()
        void refreshDashboard()
      },
      close: () => {
        const layout = ctx.get('layout') as LayoutSelectionSeam | undefined
        if (typeof layout?.selectPanel !== 'function') return
        try {
          layout.selectPanel(null)
        } catch {
          try {
            layout.selectPanel(CONVERSATION_PANEL_ID)
          } catch (error: unknown) {
            console.error('[dsh-connect-qoder-x] could not close the quota panel:', error)
          }
        }
      },
    })

    ctx.effect(() => injectQuotaCss(), 'dsh-connect-qoder-x: quota styles')

    // The dashboard cell itself needs no gate: registering for a declaration
    // that never arrives is a no-op by construction.
    try {
      ctx.slots.inject('main', () => ctx.slots.register(
        { name: 'main', key: QUOTA_PANEL_ID, locale: 'panel.qoder-quota', inject: panelFace as never },
        QuotaDashboardWithLifecycle as never,
      ))
    } catch (error: unknown) {
      console.error('[dsh-connect-qoder-x] could not register the quota dashboard:', error)
    }

    ctx.inject(['layout'], layoutCtx => {
      const layout = layoutCtx.get('layout') as LayoutSelectionSeam | undefined
      if (typeof layout?.selectPanel !== 'function') return
      try {
        for (const variant of QODER_CARD_VARIANTS) {
          const statusPath = VARIANT_STATUS[variant.id]
          if (statusPath === undefined) continue
          const injected: SidebarQuotaCardInjected = {
            t,
            statusPath,
            // Toggle semantics (the user's spec): clicking the card of the
            // variant ALREADY showing closes the panel; clicking the other
            // variant's card switches the panel to it and keeps it open.
            open: () => {
              const current = layoutCtx.get('layout') as LayoutSelectionSeam | undefined
              if (typeof current?.selectPanel !== 'function') return
              if (quotaPanelOpen && dashboardRequestedPath === statusPath) {
                current.selectPanel(null)
                return
              }
              dashboardRequestedPath = statusPath
              // An already-mounted panel will not re-render from selectPanel
              // (the panel key is unchanged), so push the tab change through
              // the revision the dashboard subscribes to. The variant switch
              // must also FETCH the newly shown variant when the shared store
              // holds nothing (or something stale) for it — without this,
              // opening the panel on one variant and switching to the other
              // showed "save a PAT" forever for a variant no surface had ever
              // fetched (its sidebar card being off means nobody polls it).
              notifyDashboard()
              void refreshDashboard()
              current.selectPanel(QUOTA_PANEL_ID)
            },
          }
          layoutCtx.slots.inject('sidebar.footer.action', () => layoutCtx.slots.register({
            name: 'sidebar.footer.action',
            id: variant.id === 'qoder' ? 'qoder-quota' : 'qoder-global-quota',
            order: variant.id === 'qoder' ? 20 : 21,
            locale: 'panel.qoder-quota',
            inject: (): SidebarQuotaCardProps | SidebarQuotaCardInjected => injected,
          } as never, SidebarQuotaCard))
        }
      } catch (error: unknown) {
        console.error('[dsh-connect-qoder-x] could not register the sidebar footer card:', error)
      }
    })

    ctx.inject(['modelDirectories'], scope => {
      scope.slots.inject('conversation.input.right', () => scope.slots.register({
        name: 'conversation.input.right',
        id: 'qoder-probe',
        order: 10,
        inject: sessionId => ({
          directory: scope.modelDirectories.directoryFor(
            sessionId as Parameters<typeof scope.modelDirectories.directoryFor>[0],
          ).store,
          t,
        }),
      }, QoderProbeControl))
    })
  } catch (error: unknown) {
    // Degrade silently on the page: the host provider still serves models.
    // Developers see the full cause in the browser console; users see no banner.
    console.error('[dsh-connect-qoder-x] client card failed to load (host provider unaffected):', error)
  }
}
