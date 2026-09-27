# -*- coding: utf-8 -*-
# Host-side edits, pass 2 (paths corrected).
import io

# ---- 1. probe-route.ts -------------------------------------------------
p = 'src/probe-route.ts'
s = io.open(p, encoding='utf-8').read()

old_parse = """  if (action === 'set-models-enabled') {"""
new_parse = """  if (action === 'set-model-context-window') {
    if (typeof wrapped['model'] !== 'string' || wrapped['model'].trim() === '') return undefined
    // A non-positive (or non-numeric) window clears the override — the model
    // falls back to its declared default.
    const raw = wrapped['window']
    const window = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
    return { action: 'set-model-context-window', model: wrapped['model'].trim(), window }
  }
  if (action === 'set-models-enabled') {"""
assert s.count(old_parse) == 1, 'parse anchor'
s = s.replace(old_parse, new_parse)

old_handler = """      if (action.action === 'set-models-enabled') {"""
new_handler = """      if (action.action === 'set-model-context-window') {
        if (deps.setModelContextWindow === undefined) {
          json(res, 404, { error: 'model-context-window-setting-not-supported' })
          return
        }
        json(res, 200, await deps.setModelContextWindow({ model: action.model as string, window: action.window ?? 0 }))
        return
      }
      if (action.action === 'set-models-enabled') {"""
assert s.count(old_handler) == 1, 'handler anchor'
s = s.replace(old_handler, new_handler)

old_dep = """  setModelsEnabled?: (options: { models: readonly string[]; enabled: boolean }) => Promise<{ state: string; reason?: string }>"""
new_dep = """  setModelsEnabled?: (options: { models: readonly string[]; enabled: boolean }) => Promise<{ state: string; reason?: string }>
  /** Write one model's context-window override (0 clears it back to default). */
  setModelContextWindow?: (options: { model: string; window: number }) => Promise<{ state: string; reason?: string }>"""
assert s.count(old_dep) == 1, 'dep anchor'
s = s.replace(old_dep, new_dep)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('probe-route ok')

# ---- 2. status-paths.ts: union + payload fields ------------------------
p = 'src/status-paths.ts'
s = io.open(p, encoding='utf-8').read()
old_type = """  action: 'probe' | 'clear' | 'refresh' | 'set-maximum-context-window' | 'clear-checkin-logs' | 'checkin' | 'set-models-enabled'"""
new_type = """  action: 'probe' | 'clear' | 'refresh' | 'set-maximum-context-window' | 'clear-checkin-logs' | 'checkin' | 'set-models-enabled' | 'set-model-context-window'"""
assert s.count(old_type) == 1, 'union anchor'
s = s.replace(old_type, new_type)

old_fields = """  /** Requested value for `set-maximum-context-window` or `set-models-enabled`. */
  enabled?: boolean"""
assert s.count(old_fields) == 1, 'fields anchor'
s = s.replace(old_fields, old_fields + """
  /** The model a `set-model-context-window` targets. */
  model?: string
  /** Requested per-model window tokens; 0 clears the override. */
  window?: number""")

# PAT summary gains the subscriber name (optional).
old_pat = """  /** Last four characters of the token. */
  patTail?: string
}"""
new_pat = """  /** Last four characters of the token. */
  patTail?: string
  /** The subscriber name the credential belongs to, when the upstream reported one. */
  accountName?: string
}"""
assert s.count(old_pat) == 1, 'pat anchor'
s = s.replace(old_pat, new_pat)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('status-paths ok')

# ---- 3. index.ts: vars + wiring + impl ---------------------------------
p = 'src/index.ts'
s = io.open(p, encoding='utf-8').read()

old_vars = "  let setModelsEnabled = ((options: { models: readonly string[]; enabled: boolean }) => Promise<{ state: string; reason?: string }>) | undefined"
new_vars = """  let setModelContextWindow: ((options: { model: string; window: number }) => Promise<{ state: string; reason?: string }>) | undefined
  let setModelContextWindowCN: ((options: { model: string; window: number }) => Promise<{ state: string; reason?: string }>) | undefined
""" + old_vars
assert s.count(old_vars) == 1, 'vars anchor'
s = s.replace(old_vars, new_vars)

old_wiring = """              setModelsEnabled: async opts => {
                if (setModelsEnabledCN === undefined) return { state: 'failed', reason: 'settings are unavailable' }
                return setModelsEnabledCN(opts)
              },
            }"""
new_wiring = """              setModelsEnabled: async opts => {
                if (setModelsEnabledCN === undefined) return { state: 'failed', reason: 'settings are unavailable' }
                return setModelsEnabledCN(opts)
              },
              setModelContextWindow: async opts => {
                if (setModelContextWindowCN === undefined) return { state: 'failed', reason: 'settings are unavailable' }
                return setModelContextWindowCN(opts)
              },
            }"""
assert s.count(old_wiring) == 1, 'cn wiring anchor'
s = s.replace(old_wiring, new_wiring)

old_wiring2 = """              setModelsEnabled: async opts => {
                if (setModelsEnabled === undefined) return { state: 'failed', reason: 'settings are unavailable' }
                return setModelsEnabled(opts)
              },
            }"""
new_wiring2 = """              setModelsEnabled: async opts => {
                if (setModelsEnabled === undefined) return { state: 'failed', reason: 'settings are unavailable' }
                return setModelsEnabled(opts)
              },
              setModelContextWindow: async opts => {
                if (setModelContextWindow === undefined) return { state: 'failed', reason: 'settings are unavailable' }
                return setModelContextWindow(opts)
              },
            }"""
assert s.count(old_wiring2) == 1, 'global wiring anchor'
s = s.replace(old_wiring2, new_wiring2)

anchor = "    setModelsEnabled = async ({ models, enabled }) => {"
impl = """    setModelContextWindow = async ({ model, window }) => {
      const windows = { ...((readConfigField(current(), 'modelContextWindows') as Record<string, number> | undefined) ?? {}) }
      if (window > 0) windows[model] = window
      else delete windows[model]
      write({ modelContextWindows: windows })
      return { state: 'updated' }
    }
    setModelContextWindowCN = async ({ model, window }) => {
      const windows = { ...((readConfigField(current(), 'modelContextWindowsCN') as Record<string, number> | undefined) ?? {}) }
      if (window > 0) windows[model] = window
      else delete windows[model]
      write({ modelContextWindowsCN: windows })
      return { state: 'updated' }
    }
"""
assert s.count(anchor) == 1, 'impl anchor'
s = s.replace(anchor, impl + anchor)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('index ok')

# ---- 4. auth.ts: carry account name through the summary -----------------
p = 'src/auth.ts'
s = io.open(p, encoding='utf-8').read()
old_sum = """      pat: {
        source: credential.source,
        ...credential.savedAtMs === undefined ? {} : { savedAtMs: credential.savedAtMs },
        ...tail === undefined ? {} : { patTail: tail },
      },"""
new_sum = """      pat: {
        source: credential.source,
        ...credential.savedAtMs === undefined ? {} : { savedAtMs: credential.savedAtMs },
        ...tail === undefined ? {} : { patTail: tail },
        ...this.accountName === undefined ? {} : { accountName: this.accountName },
      },"""
assert s.count(old_sum) == 1, 'summary anchor'
s = s.replace(old_sum, new_sum)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('auth ok')
