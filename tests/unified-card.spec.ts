import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QoderPluginCard, type QoderPluginCardProps } from '../src/client/QoderPluginCard.tsx'
import { QuotaSettingsContent } from '../src/client/QuotaSettingsCard.tsx'
import { SidebarQuotaCard } from '../src/client/SidebarQuotaCard.tsx'
import { en, zh } from '../src/client/locales.ts'
import type { QoderSettingsKey } from '../src/client/locales.ts'
import { noteQuotaSignIn, noteQuotaStatus, setQuotaToggles } from '../src/client/quota-settings-store.ts'
import { QODER_AUTH_PATH, QODER_GLOBAL_AUTH_PATH, QODER_GLOBAL_STATUS_PATH, QODER_STATUS_PATH } from '../src/status-paths.ts'

const t = (key: QoderSettingsKey, params: Record<string, unknown> = {}): string =>
  Object.entries(params).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    en[key] as string,
  )

describe('Unified Qoder Plugin Card', () => {
  let view: ReactTestRenderer | undefined
  const request = vi.fn()
  const postedActions: { url: string; body: unknown }[] = []

  beforeEach(() => {
    postedActions.length = 0
    request.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        postedActions.push({ url, body })
        return { ok: true, status: 200, json: async () => ({ ok: true, status: 'saved' }) }
      }
      const path = String(url)
      if (path === QODER_STATUS_PATH) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'signed-in',
            region: 'china',
            pat: { source: 'card', savedAtMs: 1700000000000, patTail: '1111' },
            authKey: 'cn-auth-key',
            credits: { total: 30, accounts: [] },
            models: [],
          }),
        }
      }
      if (path === QODER_GLOBAL_STATUS_PATH) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'signed-out',
            region: 'global',
            authKey: 'global-auth-key',
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ status: 'signed-out' }) }
    })
    vi.stubGlobal('fetch', request)
    vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => cb(0))
    vi.stubGlobal('window', {
      setInterval: () => 1,
      clearInterval: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
  })

  afterEach(() => {
    act(() => view?.unmount())
    setQuotaToggles(false, false)
    noteQuotaSignIn('qoder', false)
    noteQuotaSignIn('qoder-global', false)
    vi.unstubAllGlobals()
  })

  /**
   * Expand the CardSection whose header names `title`, so its body renders.
   * The header renders title text through nested spans; walk the test
   * instance's children (instances, not elements) for the string.
   */
  async function expandSection(title: string): Promise<void> {
    const head = view!.root.findAllByType('button').find(node => {
      if (node.props['aria-expanded'] === undefined) return false
      const stack: unknown[] = [...node.children]
      while (stack.length > 0) {
        const value = stack.shift()
        if (typeof value === 'string' && value.includes(title)) return true
        if (Array.isArray(value)) { stack.push(...value); continue }
        // A ReactTestInstance: descend into its children (it is not an
        // element — element props would drag fiber handles in and stringify
        // circularly).
        if (value !== null && typeof value === 'object' && Array.isArray((value as { children?: unknown[] }).children)) {
          stack.push(...(value as { children: unknown[] }).children)
        }
      }
      return false
    })
    if (head === undefined) throw new Error(`no collapsible section "${title}"`)
    await act(async () => { head.props.onClick() })
  }

  async function mountUnified(): Promise<void> {
    const fakeScope = {
      getSnapshot: () => ({
        status: 'ready' as const,
        writable: true,
        value: { sidebarQuotaCN: true, sidebarQuotaGlobal: false, quotaPollMs: 300_000 },
      }),
      subscribe: () => () => {},
      set: vi.fn(),
    }
    const props = {
      t: t as QoderPluginCardProps['t'],
      // The card is the Plugins page's configuration PAGE now, not a collapsed
      // card: the owner already drew the title and the disclosure affordance.
      view: 'page' as const,
      unified: true,
      scope: fakeScope as any,
      signedIn: () => ({ cn: true, global: false }),
    } as unknown as Parameters<typeof QoderPluginCard>[0]
    await act(async () => {
      view = create(createElement(QoderPluginCard, props))
    })
  }

  it('renders the page body with no title, intro, or disclosure chrome of its own', async () => {
    await mountUnified()
    const json = JSON.stringify(view!.toJSON())
    // The body still carries the real controls; the account heading is gone
    // (the account box's state line replaced it).
    // But it draws no heading, no intro line, and no disclosure header. The
    // Plugins page supplies the title from the package manifest and its own
    // control is what opened this page; repeating any of that here would be a
    // second, competing disclosure inside the page that already opened it.
    //
    // `unifiedTitle` ("Qoder") and `variantTabCN` ("China") are unassertable as
    // substrings — both occur throughout the body's own text — so this checks the
    // intro, which is unique, plus the structural absence of the disclosure.
    expect(json).not.toContain(en.unifiedIntro)
    // No DISCLOSURE chrome anywhere: the settings fold is gone (flat on the
    // pane) and no section claims the page is collapsed. The selected variant
    // tab (China) + selected pane (Usage) are the only tab-state.
    expect(view!.root.findAllByProps({ 'aria-expanded': true })).toHaveLength(0)
    expect(view!.root.findAllByProps({ 'aria-expanded': false })).toHaveLength(0)
    expect(view!.root.findAllByProps({ 'aria-selected': true })).toHaveLength(2)
  })

  it('renders only the one-liner when the owner asks for the summary view', async () => {
    await mountUnified()
    await act(async () => {
      view!.update(createElement(QoderPluginCard, {
        t: t as QoderPluginCardProps['t'],
        unified: true,
        view: 'summary',
      } as unknown as Parameters<typeof QoderPluginCard>[0]))
    })
    // Exactly the one-liner, as TEXT: no wrapper, no controls. The owner renders
    // this inside the card row's description line.
    expect(view!.toJSON()).toBe(en.unifiedIntro)
    // Chosen for being ABSENT from the one-liner itself, so their absence is
    // evidence about the view and not about the copy: `variantTabCN` is the bare
    // word "China", which the intro already contains.
    const json = JSON.stringify(view!.toJSON())
    expect(json).not.toContain(en.quotaToggleCN)
    expect(json).not.toContain(en.quotaPollLabel)
  })

  it('opens on the account with the variant tabs; settings sit flat below', async () => {
    await mountUnified()
    const json = JSON.stringify(view!.toJSON())
    // Variant tabs stay the ONE level of tabs
    expect(json).toContain(en.variantTabCN)
    expect(json).toContain(en.variantTabGlobal)
    // Default active is CN (signed-in in our mock)
    expect(json).toContain(t('patTail', { tail: '****1111' }))
    // Settings render FLAT (no fold to open) and SCOPED to the active
    // variant: the CN tab shows CN rows only.
    expect(json).toContain(en.quotaToggleCN)
    expect(json).toContain(en.quotaPollLabel)
    expect(json).not.toContain(en.quotaToggleGlobal)
  })

  it('switches between China and Global tabs when clicked', async () => {
    await mountUnified()
    // Find the segmented tab buttons: China and Global
    const tabList = view!.root.find(n => n.props.role === 'tablist' && n.props['aria-label'] === 'Qoder Version Selection')
    const tabButtons = tabList.findAllByType('button')
    expect(tabButtons).toHaveLength(2)

    // Click Global tab (second tab)
    const globalTab = tabButtons[1]!
    await act(async () => { globalTab.props.onClick() })

    let json = JSON.stringify(view!.toJSON())
    // Global is signed out in mock, so it shows signed-out hint and Global PAT guide
    expect(json).toContain(en.signedOutHintAI)
    expect(json).toContain(en.patGuideAI)

    // Click China tab again (first tab)
    const cnTab = tabButtons[0]!
    await act(async () => { cnTab.props.onClick() })

    json = JSON.stringify(view!.toJSON())
    expect(json).toContain(t('patTail', { tail: '****1111' }))
  })

  it('reactively enables sidebar quota toggle when user signs in or saves PAT', async () => {
    let cnSignedIn = false
    request.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        postedActions.push({ url, body })
        if (body.action === 'save-pat') {
          cnSignedIn = true
        }
        return { ok: true, status: 200, json: async () => ({ ok: true, status: 'saved' }) }
      }
      const path = String(url)
      if (path === QODER_STATUS_PATH) {
        return {
          ok: true,
          status: 200,
          json: async () => cnSignedIn ? ({
            status: 'signed-in',
            region: 'china',
            pat: { source: 'card', savedAtMs: 1700000000000, patTail: '2222' },
            authKey: 'cn-auth-key',
            credits: { total: 50, accounts: [] },
            models: [],
          }) : ({
            status: 'signed-out',
            region: 'china',
            authKey: 'cn-auth-key',
          }),
        }
      }
      if (path === QODER_GLOBAL_STATUS_PATH) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'signed-out',
            region: 'global',
            authKey: 'global-auth-key',
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ status: 'signed-out' }) }
    })

    const fakeScope = {
      getSnapshot: () => ({
        status: 'ready' as const,
        writable: true,
        value: { sidebarQuotaCN: false, sidebarQuotaGlobal: false, quotaPollMs: 300_000 },
      }),
      subscribe: () => () => {},
      set: vi.fn(),
    }
    const props = {
      t: t as QoderPluginCardProps['t'],
      // The card is the Plugins page's configuration PAGE now, not a collapsed
      // card: the owner already drew the title and the disclosure affordance.
      view: 'page' as const,
      unified: true,
      scope: fakeScope as any,
    } as unknown as Parameters<typeof QoderPluginCard>[0]

    await act(async () => {
      view = create(createElement(QoderPluginCard, props))
    })

    // Settings sit flat on the Usage pane, scoped to the CN variant.
    // Find the toggle switches: first one is China quota toggle
    const switches = view!.root.findAll(n => n.props.role === 'switch')
    expect(switches.length).toBeGreaterThanOrEqual(1)
    const cnSwitch = switches[0]!
    // Initially disabled because cn is signed out
    expect(cnSwitch.props.disabled).toBe(true)

    // Fill in PAT input and click save
    const patInput = view!.root.find(n => n.type === 'input' && n.props.type === 'password')
    await act(async () => {
      patInput.props.onChange({ target: { value: 'test-pat-token' } })
    })

    // Click save button
    const saveBtn = view!.root.findAll(n => n.type === 'button' && n.props.children === en.patSave)[0]!
    await act(async () => {
      await saveBtn.props.onClick()
    })

    // After saving PAT, China switch must be reactively enabled!
    const updatedSwitches = view!.root.findAll(n => n.props.role === 'switch')
    const updatedCnSwitch = updatedSwitches[0]!
    expect(updatedCnSwitch.props.disabled).toBe(false)
  })

  it('(a) disables quota switches when accounts are not signed in and (b) prevents disabled click from calling scope.set', async () => {
    request.mockImplementation(async () => {
      return { ok: true, status: 200, json: async () => ({ status: 'signed-out' }) }
    })
    const mockSet = vi.fn()
    const fakeScope = {
      getSnapshot: () => ({
        status: 'ready' as const,
        writable: true,
        value: { sidebarQuotaCN: false, sidebarQuotaGlobal: false, quotaPollMs: 300_000 },
      }),
      subscribe: () => () => {},
      set: mockSet,
    }
    const props = {
      t: t as QoderPluginCardProps['t'],
      // The card is the Plugins page's configuration PAGE now, not a collapsed
      // card: the owner already drew the title and the disclosure affordance.
      view: 'page' as const,
      unified: true,
      scope: fakeScope as any,
      signedIn: () => ({ cn: false, global: false }),
    } as unknown as Parameters<typeof QoderPluginCard>[0]

    await act(async () => {
      view = create(createElement(QoderPluginCard, props))
    })

    // Expand the card
    const headerBtn = view!.root.findAllByType('button')[0]!
    await act(async () => { headerBtn.props.onClick() })

    // (a) Verify switches are disabled when not signed in (CN-scoped rows).
    const switches = view!.root.findAll(n => n.props.role === 'switch')
    expect(switches.length).toBeGreaterThanOrEqual(1)
    const [cnSwitch] = switches
    expect(cnSwitch!.props.disabled).toBe(true)

    // (b) Simulate clicking switches in disabled state; verify scope.set is NEVER triggered
    await act(async () => {
      cnSwitch!.props.onClick()
    })
    // The Global rows are not rendered on the CN-scoped pane; there is no
    // globalSwitch to click, and the CN switch is disabled anyway.
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('(c) safely blocks SidebarQuotaCard click when status is signed-out in wide and rail modes', async () => {
    request.mockImplementation(async () => {
      return { ok: true, status: 200, json: async () => ({ status: 'signed-out' }) }
    })

    // Enable quota toggles so SidebarQuotaCard renders instead of returning null
    setQuotaToggles(true, true)
    noteQuotaStatus('qoder', { status: 'signed-out' })
    noteQuotaSignIn('qoder', false)

    const openMock = vi.fn()

    // 1. Wide mode test
    let wideView: ReactTestRenderer | undefined
    await act(async () => {
      wideView = create(createElement(SidebarQuotaCard, {
        t: t as any,
        statusPath: QODER_STATUS_PATH,
        open: openMock,
        wide: true,
      } as any))
    })

    const wideBtn = wideView!.root.findByProps({ className: 'qdp-foot' })
    expect(wideBtn.props.disabled).toBe(true)

    // Attempt clicking wide button while signed-out
    await act(async () => {
      wideBtn.props.onClick()
    })
    expect(openMock).not.toHaveBeenCalled()
    act(() => wideView?.unmount())

    // 2. Rail mode (collapsed icon button) test
    let railView: ReactTestRenderer | undefined
    await act(async () => {
      railView = create(createElement(SidebarQuotaCard, {
        t: t as any,
        statusPath: QODER_STATUS_PATH,
        open: openMock,
        wide: false,
      } as any))
    })

    const railBtn = railView!.root.findByProps({ className: 'qdp-railButton' })
    expect(railBtn.props.disabled).toBe(true)

    // Attempt clicking rail button while signed-out
    await act(async () => {
      railBtn.props.onClick()
    })
    expect(openMock).not.toHaveBeenCalled()
    act(() => railView?.unmount())

    // 3. When signed-in, clicking wide button opens dashboard
    request.mockImplementation(async (url: string) => {
      const path = String(url)
      if (path === QODER_STATUS_PATH) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'signed-in',
            region: 'china',
            credits: { total: 50, accounts: [] },
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ status: 'signed-out' }) }
    })
    noteQuotaStatus('qoder', {
      status: 'signed-in',
      credits: { total: 50, accounts: [] },
    })
    noteQuotaSignIn('qoder', true)

    let signedInView: ReactTestRenderer | undefined
    await act(async () => {
      signedInView = create(createElement(SidebarQuotaCard, {
        t: t as any,
        statusPath: QODER_STATUS_PATH,
        open: openMock,
        wide: true,
      } as any))
    })

    const signedInBtn = signedInView!.root.findByProps({ className: 'qdp-foot' })
    expect(signedInBtn.props.disabled).toBe(false)

    await act(async () => {
      signedInBtn.props.onClick()
    })
    expect(openMock).toHaveBeenCalledTimes(1)
    act(() => signedInView?.unmount())
  })

  it('rejects write to scope.set when attempting to turn on sidebarQuotaCN/Global while unsigned', async () => {
    const mockSet = vi.fn()
    const fakeScope = {
      getSnapshot: () => ({
        status: 'ready' as const,
        writable: true,
        value: { sidebarQuotaCN: false, sidebarQuotaGlobal: false, quotaPollMs: 300_000 },
      }),
      subscribe: () => () => {},
      set: mockSet,
    }
    let contentRenderer: ReactTestRenderer | undefined
    await act(async () => {
      contentRenderer = create(createElement(QuotaSettingsContent, {
        t: t as any,
        scope: fakeScope as any,
        signedIn: () => ({ cn: false, global: false }),
      }))
    })

    const switches = contentRenderer!.root.findAll(n => n.props.role === 'switch')
    expect(switches.length).toBeGreaterThanOrEqual(2)
    for (const sw of switches) {
      expect(sw.props.disabled).toBe(true)
    }

    // Even if onToggle was triggered directly with next=true, write() must intercept and drop it
    const toggleRows = contentRenderer!.root.findAll(n => typeof n.props.onToggle === 'function')
    for (const row of toggleRows) {
      await act(async () => {
        row.props.onToggle(true)
      })
    }
    expect(mockSet).not.toHaveBeenCalled()
    act(() => contentRenderer?.unmount())
  })

  it('renders the check-in state and its actions on the Usage pane when logs exist', async () => {
    request.mockImplementation(async (url: string) => {
      const path = String(url)
      if (path === QODER_STATUS_PATH) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'signed-in',
            region: 'china',
            pat: { source: 'card', savedAtMs: 1700000000000, patTail: '1111' },
            authKey: 'cn-auth-key',
            credits: { total: 30, accounts: [] },
            models: [],
            checkIn: {
              lastDate: '2026-09-21',
              lastAt: 1700000000000,
              status: 'claimed',
              amount: 100,
              logs: [
                {
                  id: 'log-1',
                  date: '2026-09-21',
                  timestamp: 1700000000000,
                  status: 'claimed',
                  amount: 100,
                },
              ],
            },
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ status: 'signed-out' }) }
    })

    await act(async () => {
      view = create(createElement(QoderPluginCard, {
        t: t as any,
        unified: true,
        view: 'page',
      } as any))
    })

    // Check-in lives on the Usage pane's own line: state text and action
    // buttons are visible without any expansion.

    // The state line states today's claim (+100) without any expansion.
    const states = view!.root.findAll(n => typeof n.props.children === 'string' && n.props.children.includes('+100 Credits'))
    expect(states.length).toBeGreaterThanOrEqual(1)

    // Expand the log and verify its entries rendered
    const logsBtn = view!.root.findAll(n => n.props.onClick && n.children.includes(en.checkInLogShow))[0]
    expect(logsBtn).toBeDefined()
    await act(async () => { logsBtn!.props.onClick() })
    const amounts = view!.root.findAll(n => n.children.includes('+100'))
    expect(amounts.length).toBeGreaterThanOrEqual(1)

    // Verify action buttons exist on the check-in line (check in now, refresh, clear)
    const checkInBtn = view!.root.findAll(n => n.children.includes(en.checkInNow))
    expect(checkInBtn.length).toBeGreaterThanOrEqual(1)
    const refreshBtn = view!.root.findAll(n => n.children.includes(en.checkInRefresh))
    expect(refreshBtn.length).toBeGreaterThanOrEqual(1)
    const clearBtn = view!.root.findAll(n => n.children.includes(en.checkInClear))
    expect(clearBtn.length).toBeGreaterThanOrEqual(1)
  })

  it('stores a typed check-in time as minutes past midnight in UTC+8', async () => {
    const mockSet = vi.fn()
    const fakeScope = {
      getSnapshot: () => ({
        status: 'ready' as const,
        writable: true,
        value: {
          sidebarQuotaCN: false,
          sidebarQuotaGlobal: false,
          autoCheckInCN: true,
          autoCheckInGlobal: false,
          checkInMinuteCN: 600,
          checkInMinuteGlobal: 600,
          quotaPollMs: 300_000,
        },
      }),
      subscribe: () => () => {},
      set: mockSet,
    }
    let renderer: ReactTestRenderer | undefined
    await act(async () => {
      renderer = create(createElement(QuotaSettingsContent, {
        t: t as any,
        scope: fakeScope as any,
        signedIn: () => ({ cn: true, global: false }),
      }))
    })

    // Two rows, each an hour and a minute field — typeable under any input
    // method, unlike the `type="time"` spinner segments this replaced.
    const part = (name: string, index = 0) =>
      renderer!.root.findAll(n => n.props['data-checkin-part'] === name)[index]!
    expect(renderer!.root.findAll(n => n.props['data-checkin-part'] === 'hour')).toHaveLength(2)
    expect(renderer!.root.findAll(n => n.props['data-checkin-part'] === 'minute')).toHaveLength(2)
    expect(renderer!.root.findAll(n => n.props.type === 'time')).toHaveLength(0)

    // The stored minute count renders as 10:00.
    expect(part('hour').props.value).toBe('10')
    expect(part('minute').props.value).toBe('00')

    await act(async () => { part('hour').props.onChange({ target: { value: '14' } }) })
    await act(async () => { part('minute').props.onChange({ target: { value: '30' } }) })
    // Nothing is written mid-typing; the commit is what persists it.
    expect(mockSet).not.toHaveBeenCalled()
    await act(async () => { part('hour').props.onBlur() })
    expect(mockSet).toHaveBeenCalledWith('checkInMinuteCN', 870)

    // The Global row stays locked while its own account is signed out.
    expect(part('hour', 1).props.disabled).toBe(true)
    expect(part('minute', 1).props.disabled).toBe(true)
    act(() => renderer?.unmount())
  })
})
