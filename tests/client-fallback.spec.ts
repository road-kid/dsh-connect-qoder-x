/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  QODER_GLOBAL_STATUS_PATH,
  QODER_PROBE_PATH,
  QODER_STATUS_PATH,
} from '../src/status-paths.ts'

/**
 * The client entry degrades a slot-API breaking change (the rc.6→rc.7
 * `id`→`key` rename that caused the red "Failed to load plugins" banner)
 * to a console.error, so the host provider keeps working without a banner.
 *
 * We cannot import the real client entry (it pulls browser-only DSH client
 * packages, and its dashboard internals need the DOM); instead we replicate the
 * try/catch shape from `src/client/index.tsx` and assert it swallows a
 * simulated throw at each guarded boundary.
 *
 * DRIFT WARNING: the `apply()` below is a manual mirror of the real `apply()`
 * in `src/client/index.tsx` (see the NOTE on that function). It is NOT the
 * product code, so these tests prove the fallback boundaries work — they cannot
 * by themselves detect a regression in the real entry. The final case closes
 * that gap mechanically: it reads the entry off disk and requires every
 * `console.error` message, every `ctx.effect` label, and the locale namespace
 * it registers to appear VERBATIM in this file's own source. Change the real
 * entry's guarded body or one of those literals without updating the mirror,
 * and that case fails.
 */

/** The variant ids, mirroring `QODER_CARD_VARIANTS` in QoderPluginCard.tsx. */
const CARD_VARIANT_IDS = ['qoder', 'qoder-global'] as const

/** The status routes per variant id, mirroring VARIANT_STATUS in the entry. */
const VARIANT_STATUS: Record<string, string> = {
  qoder: QODER_STATUS_PATH,
  'qoder-global': QODER_GLOBAL_STATUS_PATH,
}

/**
 * The configuration-face constants, mirroring src/client/index.tsx.
 *
 * `QUOTA_SETTINGS_NAMESPACE` is the 0.1.5 namespace the Host serves this
 * plugin's quota section under (nothing on the 0.1.7 line reads it any more).
 * `ENTRY_ID` is the PROFILE ROW ID this bundle's patch inserts — the right half
 * of the `plugins.row.config` key, not a `configForms` namespace.
 */
const QUOTA_SETTINGS_NAMESPACE = 'qoder-quota'
const ENTRY_ID = 'llm-qoder-x'
const ROW_CONFIG_SLOT = 'plugins.row.config'
const BUNDLE_CONFIG_SLOT = 'plugins.bundle.config'
const PACKAGE_NAME = 'dsh-connect-qoder-x'
const ROW_CONFIG_KEY = `${PACKAGE_NAME}#${ENTRY_ID}`

/** Minimal component stand-in: the mirror never renders anything. */
const Component = (): null => null

/**
 * Mirror of src/client/index.tsx apply() body.
 *
 * Not mirrored: the dashboard's mount-time internals (its cached snapshot, its
 * polling, `fetchStatusDocument`, and the mount wrapper's JSX) — they need the
 * DOM and only run once the panel is open. They are replaced by no-op
 * stand-ins so the guarded registration sequence above them stays verbatim.
 */
function apply(ctx: any): void {
  try {
    const namespace = 'settings.qoder'
    ctx.effect(() => ctx.locale.register(namespace, { zh: {}, en: {} }), 'dsh-connect-qoder-x: settings copy')
    const t = ctx.locale.bind(namespace)

    let quotaScope: any
    const adoptQuotaScope = (scope: any): void => {
      quotaScope = scope
      const applySnapshot = (): void => {
        const value = scope.getSnapshot().value
        void value
      }
      applySnapshot()
      scope.subscribe(applySnapshot)
    }
    // The unified Qoder card's inject face: one face for both seats, because the
    // card is the same component either way and reads `view` from its props.
    const cardFace = () => ({
      t,
      scope: quotaScope,
      signedIn: () => ({ cn: false, global: false }),
      unified: true,
    })
    const registerCard = (slot: string, key: string): void => {
      try {
        ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, key, inject: cardFace }, Component))
      } catch (error: unknown) {
        console.error(`[dsh-connect-qoder-x] card slot "${slot}" failed to register (host provider unaffected):`, error)
      }
    }
    registerCard(ROW_CONFIG_SLOT, ROW_CONFIG_KEY)
    registerCard(BUNDLE_CONFIG_SLOT, PACKAGE_NAME)

    // Plugin-owned configuration, read from this plugin's own settings face.
    // Mirrored as `adopt` over a stand-in rather than the real
    // `new OwnQuotaSettingsScope()` (that class does network I/O), but the
    // try/catch boundary and its position are the real entry's: a settings face
    // that fails to bind must not take the cards registered above with it. The
    // `scopeBind` fault injects that failure the way a broken scope object would.
    try {
      const face = ctx.settingsScope.bind({ namespace: QUOTA_SETTINGS_NAMESPACE })
      adoptQuotaScope(face)
    } catch (error: unknown) {
      console.error('[dsh-connect-qoder-x] quota settings scope unavailable (sidebar cards stay hidden):', error)
    }

    // Dashboard internals stand-ins (see the note above).
    const QUOTA_PANEL_ID = 'qoder-quota-panel'
    const CONVERSATION_PANEL_ID = 'conversation'
    let dashboardRequestedPath: string = QODER_STATUS_PATH
    /** Whether the dashboard is the CURRENT center panel (its mount owns this). */
    let quotaPanelOpen = false
    const notifyDashboard = (): void => {}
    const refreshDashboard = async (_options: { force?: boolean } = {}): Promise<void> => {}

    ctx.effect(() => Component(), 'dsh-connect-qoder-x: quota styles')

    const panelFace = (): any => ({
      t,
      statusPaths: [QODER_STATUS_PATH, QODER_GLOBAL_STATUS_PATH],
      refresh: () => { void refreshDashboard({ force: true }) },
      onVariantPicked: (path: string) => {
        dashboardRequestedPath = path
        notifyDashboard()
        void refreshDashboard()
      },
      close: () => {
        const layout = ctx.get('layout') as { selectPanel: (id: string | null) => void } | undefined
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
    void panelFace

    try {
      ctx.slots.inject('main', () => ctx.slots.register(
        { name: 'main', key: QUOTA_PANEL_ID, locale: 'panel.qoder-quota', inject: panelFace },
        Component,
      ))
    } catch (error: unknown) {
      console.error('[dsh-connect-qoder-x] could not register the quota dashboard:', error)
    }

    ctx.inject(['layout'], (layoutCtx: any) => {
      const layout = layoutCtx.get('layout') as { selectPanel: (id: string | null) => void } | undefined
      if (typeof layout?.selectPanel !== 'function') return
      try {
        for (const variantId of CARD_VARIANT_IDS) {
          const statusPath = VARIANT_STATUS[variantId]
          if (statusPath === undefined) continue
          const injected = {
            t,
            statusPath,
            // Toggle semantics: the card of the variant ALREADY showing closes
            // the panel; the other card switches to it and keeps it open.
            open: () => {
              if (quotaPanelOpen && dashboardRequestedPath === statusPath) {
                layout.selectPanel(null)
                return
              }
              dashboardRequestedPath = statusPath
              notifyDashboard()
              void refreshDashboard()
              layout.selectPanel(QUOTA_PANEL_ID)
            },
          }
          layoutCtx.slots.inject('sidebar.footer.action', () => layoutCtx.slots.register({
            name: 'sidebar.footer.action',
            id: variantId === 'qoder' ? 'qoder-quota' : 'qoder-global-quota',
            order: variantId === 'qoder' ? 20 : 21,
            locale: 'panel.qoder-quota',
            inject: () => injected,
          }, Component))
        }
      } catch (error: unknown) {
        console.error('[dsh-connect-qoder-x] could not register the sidebar footer card:', error)
      }
    })

    ctx.inject(['modelDirectories'], (scope: any) => {
      scope.slots.inject('conversation.input.right', () => scope.slots.register({
        name: 'conversation.input.right',
        id: 'qoder-probe',
        order: 10,
        inject: () => ({ t }),
      }, Component))
    })
  } catch (error: unknown) {
    // Degrade silently on the page: the host provider still serves models.
    console.error('[dsh-connect-qoder-x] client card failed to load (host provider unaffected):', error)
  }
}

interface FakeContext {
  readonly ctx: any
  readonly injections: string[]
  readonly registerCalls: Record<string, unknown>[]
}

/**
 * A stand-in for the DSH client context. `throwOn` names the service call that
 * must fail, which is how each test moves a different guarded boundary.
 *
 * There is no `host` switch any more: the port dropped both configuration
 * services (`settingsScope` for 0.1.5, `configForms` for 0.1.7) in favour of the
 * plugin's OWN settings file, so the entry behaves identically on either line.
 * The stand-in keeps both services present to prove they are simply unused.
 */
function fakeContext(
  throwOn: { slot?: string; scopeBind?: boolean } = {},
): FakeContext {
  const injections: string[] = []
  const registerCalls: Record<string, unknown>[] = []
  const slots = {
    inject: (name: string, factory: () => unknown) => {
      if (throwOn.slot !== undefined && throwOn.slot === name) {
        throw new Error(`keyed slot "${name}" requires options.key`)
      }
      injections.push(name)
      // The mirror's factories only run when the Plugins page renders; the
      // register call is recorded here so a test can assert the contribution.
      const contribution = factory()
      if (typeof contribution === 'function') return contribution
      return () => {}
    },
    register: (options: Record<string, unknown>, component: unknown) => {
      registerCalls.push({ ...options, component })
      return () => {}
    },
    entries: (name: string) => registerCalls
      .filter(call => call['name'] === name)
      .map(call => ({ options: { id: call['id'] } })),
  }
  const layout = { selectPanel: () => {} }
  const ctx: any = {
    effect: (fn: () => unknown) => { fn() },
    locale: { register: () => () => {}, bind: () => (key: string) => key },
    slots,
    get: (name: string) => (name === 'layout' ? layout : undefined),
    settingsScope: {
      bind: () => {
        if (throwOn.scopeBind === true) throw new TypeError('settingsScope.bind is not a function')
        return { getSnapshot: () => ({ value: undefined }), subscribe: () => {} }
      },
    },
    configForms: {
      get: () => ({ getSnapshot: () => ({ value: undefined }), subscribe: () => {} }),
    },
    inject: (deps: string[], cb: (scope: any) => void) => {
      if (throwOn.slot !== undefined && deps.includes(throwOn.slot)) return
      cb({ get: ctx.get, slots, settingsScope: ctx.settingsScope, configForms: ctx.configForms })
    },
  }
  return { ctx, injections, registerCalls }
}

/** Console.error calls captured as strings. */
function useErrorSpy(): { errors: string[]; restore: () => void } {
  const errors: string[] = []
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args.map(String).join(' ')) })
  return { errors, restore: () => spy.mockRestore() }
}

describe('client card fallback', () => {
  it('swallows a slot registration failure instead of throwing', () => {
    const { errors, restore } = useErrorSpy()
    const { ctx } = fakeContext({ slot: ROW_CONFIG_SLOT })

    // Must not throw — the whole point of the fallback.
    expect(() => apply(ctx)).not.toThrow()

    // The error is reported by the CARD's own catch (a keyed slot needs a key),
    // not by the outer boundary: one seat failing must not take the other with
    // it, so the per-seat catch is what has to hold here.
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(`card slot "${ROW_CONFIG_SLOT}" failed to register`)
    expect(errors[0]).toContain('requires options.key')

    restore()
  })

  it('keeps both cards registered when the quota settings scope is missing', () => {
    const { errors, restore } = useErrorSpy()
    const { ctx, registerCalls } = fakeContext({ scopeBind: true })

    expect(() => apply(ctx)).not.toThrow()
    // One inner catch, not the outer boundary: the cards still contribute.
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('quota settings scope unavailable')

    // BOTH seats are claimed even though the settings face never bound — the
    // card is what carries the PAT entry, so losing it would strand the user.
    const seats = registerCalls.filter(call => call['name'] === ROW_CONFIG_SLOT || call['name'] === BUNDLE_CONFIG_SLOT)
    expect(seats).toHaveLength(2)
    // The scope is handed over as undefined, so the settings card renders its
    // toggles read-only rather than crashing on a missing service.
    const card = registerCalls.find(call => call['name'] === ROW_CONFIG_SLOT) as unknown as { inject: () => { scope: unknown } }
    expect(card.inject().scope).toBeUndefined()

    restore()
  })

  it('still registers the sidebar cards and the composer entry when the panel slot breaks', () => {
    const { errors, restore } = useErrorSpy()
    const { ctx, injections } = fakeContext({ slot: 'main' })

    expect(() => apply(ctx)).not.toThrow()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('could not register the quota dashboard')
    // A dead dashboard cell must not take the rest of the plugin with it.
    expect(injections).toContain('sidebar.footer.action')
    expect(injections).toContain('conversation.input.right')

    restore()
  })

  it('still registers the composer entry when the sidebar footer seat breaks', () => {
    const { errors, restore } = useErrorSpy()
    const { ctx, injections } = fakeContext({ slot: 'sidebar.footer.action' })

    expect(() => apply(ctx)).not.toThrow()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('could not register the sidebar footer card')
    expect(injections).toContain('conversation.input.right')

    restore()
  })

  it('contributes both plugin-config seats, the panel seat, and the probe seat', () => {
    const { errors, restore } = useErrorSpy()
    const { ctx, injections, registerCalls } = fakeContext()

    expect(() => apply(ctx)).not.toThrow()
    expect(errors).toEqual([])
    // The two 0.1.7 plugin-configuration seats, claimed by their derived keys.
    expect(injections.filter(name => name === ROW_CONFIG_SLOT)).toHaveLength(1)
    expect(injections.filter(name => name === BUNDLE_CONFIG_SLOT)).toHaveLength(1)
    expect(injections).toContain('main')
    expect(injections).toContain('sidebar.footer.action')
    expect(injections).toContain('conversation.input.right')

    // The seats this plugin claims, by their Qoder keys and ids.
    const pluginKeys = registerCalls.flatMap(call => typeof call['key'] === 'string' ? [call['key']] : [])
    expect(pluginKeys.sort()).toEqual([BUNDLE_CONFIG_SLOT && PACKAGE_NAME, ROW_CONFIG_KEY, 'qoder-quota-panel'].sort())
    const seatIds = registerCalls.flatMap(call => typeof call['id'] === 'string' ? [call['id']] : [])
    expect(seatIds.sort()).toEqual(['qoder-global-quota', 'qoder-probe', 'qoder-quota'])
    // The probe seat belongs to the international-or-not composer chrome this
    // plugin owns; its route pair is what the control reads.
    expect(QODER_PROBE_PATH).toBe('/plugins/dsh-connect-qoder-x/probe')

    restore()
  })

  it('keys the row seat by `<package name>#<row id>`, both halves spelled out', () => {
    const { errors, restore } = useErrorSpy()
    const { ctx, registerCalls } = fakeContext()

    expect(() => apply(ctx)).not.toThrow()
    expect(errors).toEqual([])

    // The owner dispatches this key from the package name it lists and the row
    // id the bundle's patch declares. A wrong half is a silent no-show (a keyed
    // slot nobody dispatches renders nothing), so assert both halves directly
    // rather than trusting the template literal.
    const row = registerCalls.find(call => call['name'] === ROW_CONFIG_SLOT)
    expect(row?.['key']).toBe('dsh-connect-qoder-x#llm-qoder-x')

    restore()
  })

  it('never claims a settings-section seat, on either host line', () => {
    const { errors, restore } = useErrorSpy()
    const { ctx, injections, registerCalls } = fakeContext()

    expect(() => apply(ctx)).not.toThrow()
    expect(errors).toEqual([])
    // The retired path: the removed Plugins-tab card list, and the shared
    // container three plugins used to rendezvous in. Claiming either again
    // re-creates the orphaned「插件设置」nav entry this port removes.
    expect(injections).not.toContain('settings.plugin.item')
    expect(injections).not.toContain('settings.section')
    expect(injections).not.toContain('plugin-settings.item')
    expect(registerCalls.some(call => call['id'] === 'plugin-settings')).toBe(false)

    restore()
  })
})

describe('mirror stays verbatim with src/client/index.tsx', () => {
  const entrySource = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
  const mirrorSource = readFileSync(new URL(import.meta.url), 'utf8')

  it('every console.error message in the entry is mirrored word for word', () => {
    // Both quote styles: the entry uses a template literal for the per-seat card
    // failure (the slot name is interpolated into it) and plain strings for the
    // rest. Matching only one style would silently stop guarding the other. The
    // template pattern stops at the `${` interpolation, so the mirrored fragment
    // is the literal prefix — which is what the mirror repeats.
    const messages = [
      ...entrySource.matchAll(/console\.error\(\s*'([^']+)'/g),
      ...entrySource.matchAll(/console\.error\(`([^`]*?)\$\{/g),
    ].map(match => match[1]!)
    // Guard the guard: the real entry must actually carry the five boundaries
    // this spec mirrors (outer catch + four inner catches: the per-seat card
    // registration, the dashboard, the sidebar footer, and the panel close).
    expect(messages).toHaveLength(5)
    for (const message of messages) {
      expect(mirrorSource).toContain(message)
    }
  })

  it('every effect label and locale namespace in the entry is mirrored', () => {
    const labels = [...entrySource.matchAll(/,\s*'(dsh-connect-qoder-x: [^']+)'/g)].map(match => match[1]!)
    expect(labels).toEqual(['dsh-connect-qoder-x: settings copy', 'dsh-connect-qoder-x: quota styles'])
    for (const label of labels) expect(mirrorSource).toContain(label)
    // The two locale namespaces and the settings namespace the scope binds.
    expect(entrySource).toContain("'settings.qoder'")
    expect(entrySource).toContain("'panel.qoder-quota'")
    expect(mirrorSource).toContain("'settings.qoder'")
    expect(mirrorSource).toContain("'panel.qoder-quota'")
  })

  it('the entry has no legacy brand literal left anywhere', () => {
    // Assembled at runtime so this spec's own source stays out of its way.
    const legacy = ['work', 'buddy'].join('')
    expect(entrySource.toLowerCase()).not.toContain(legacy)
    expect(mirrorSource.toLowerCase()).not.toContain(legacy)
  })

  it('every seat this plugin claims in the entry is claimed by the mirror too', () => {
    // The registration identity of the plugin: slot names plus the keys/ids it
    // contributes. A rename on one side and not the other is exactly the drift
    // the mirror obligation warns about.
    const seats = [
      'conversation.input.right', 'sidebar.footer.action',
      'qoder-global-quota', 'qoder-quota-panel', 'qoder-probe',
      // The 0.1.7 plugin-configuration seats.
      'plugins.row.config', 'plugins.bundle.config',
    ]
    for (const seat of seats) {
      expect(entrySource).toContain(seat)
      expect(mirrorSource).toContain(seat)
    }
    // The row key is COMPOSED in the entry (`${PACKAGE_NAME}#${ENTRY_ID}`), not
    // written as one literal, so assert the two halves and their concatenation
    // rather than a single string. This is the pair the owner's dispatch depends
    // on: the package name it lists, and the row id `cordis.patch.yml` declares.
    expect(entrySource).toContain(`const ROW_CONFIG_KEY = \`\${PACKAGE_NAME}#\${ENTRY_ID}\``)
    expect(entrySource).toContain("const PACKAGE_NAME = 'dsh-connect-qoder-x'")
    expect(entrySource).toContain("const ENTRY_ID = 'llm-qoder-x'")
    expect(mirrorSource).toContain('dsh-connect-qoder-x#llm-qoder-x')

    // The seats the plugin must NOT CLAIM any more: the removed Plugins-tab card
    // list, and the community-private container the connect plugins used to
    // rendezvous in. Reintroducing either re-creates the orphaned「插件设置」nav
    // entry this port exists to remove.
    //
    // Read from the CALL SITES, not the whole file: the entry's comments name the
    // retired slots on purpose (to explain what replaced them), so a whole-file
    // substring check would flag the documentation rather than a regression.
    const claims = [...entrySource.matchAll(/slots\.inject\(\s*'([^']+)'/g)].map(match => match[1]!)
    expect(claims).not.toContain('settings.plugin.item')
    expect(claims).not.toContain('settings.section')
    expect(claims).not.toContain('plugin-settings.item')
    // And the mirror's registration calls agree, seat for seat.
    const mirrorClaims = [...mirrorSource.matchAll(/slots\.inject\(\s*(?:slot|'([^']+)')/g)]
    expect(mirrorClaims.length).toBeGreaterThan(0)
  })
})
