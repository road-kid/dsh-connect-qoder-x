# -*- coding: utf-8 -*-
# Card body pass 3.
import io

p = 'src/client/QoderPluginCard.tsx'
s = io.open(p, encoding='utf-8').read()

# ---- (3)(4) variant tabs: enable checkbox per side; stray rule removed ----
old_tabs = """            <div style={segmentedContainerStyle} role="tablist" aria-label="Qoder Version Selection">
              <button
                type="button"
                role="tab"
                aria-selected={activeVariantId === 'qoder'}
                style={segmentedTabItemStyle(activeVariantId === 'qoder')}
                onClick={() => setActiveVariantId('qoder')}
              >
                <span style={dotStyle(cnDotStatus)} aria-hidden="true" />
                <span>{t('variantTabCN')}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeVariantId === 'qoder-global'}
                style={segmentedTabItemStyle(activeVariantId === 'qoder-global')}
                onClick={() => setActiveVariantId('qoder-global')}
              >
                <span style={dotStyle(globalDotStatus)} aria-hidden="true" />
                <span>{t('variantTabGlobal')}</span>
              </button>
            </div>
          </>
        ) : null}"""
new_tabs = """            <div className="qdp-seg" role="tablist" aria-label="Qoder Version Selection">
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
        ) : null}"""
assert s.count(old_tabs) == 1, 'tabs anchor'
s = s.replace(old_tabs, new_tabs)

# ---- (5) account box + PAT box ------------------------------------------
old_account = """          <h3 className="qdp-h3">{t('accountHeading')}</h3>
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
          </div>"""
new_account = """          {/*
           * The account box (workbuddy's usage-account): signed-in line and
           * its expiry/notice copy on the left, refresh right-aligned inside.
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
              {status?.status === 'signed-in' && status.pat === undefined ? null : (
                <span className="qdp-accountExpiry">
                  {status?.status === 'signed-in' && status.pat !== undefined
                    ? [patSourceText(status.pat.source, t),
                       status.pat.accountName,
                       status.pat.savedAtMs === undefined ? null : t('patSavedAt', { time: formatTime(status.pat.savedAtMs) }),
                       status.pat.patTail === undefined ? null : t('patTail', { tail: `****${status.pat.patTail}` })].filter(Boolean).join(' · ')
                    : label}
                </span>
              )}
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
                    <span className="qdp-patBoxName">{status.pat.accountName ?? t('patBoxLabel')}</span>
                    <span className="qdp-patBoxMeta">
                      {status.pat.savedAtMs === undefined ? null : `${t('patSavedAt', { time: formatTime(status.pat.savedAtMsMs ?? status.pat.savedAtMs) })} · `}
                      {status.pat.patTail === undefined ? '' : t('patTail', { tail: `****${status.pat.patTail}` })}
                    </span>
                  </div>
                  <button type="button" className="qdp-btn qdp-btnDangerQuiet" disabled={busy || patBusy} onClick={() => { setConfirmingClear(true) }}>
                    {t('patRemove')}
                  </button>
                </div>}"""
assert s.count(old_account) == 1, 'account anchor'
s = s.replace(old_account, new_account)

# signedInLabel replaces the raw `label` inside the box's state line.
old_label = """  const label = status === undefined
    ? t('loading')
    : status.status === 'signed-in'
      ? t('signedIn')
      : status.status === 'error'
        ? t('requestFailed')
        : t('signedOut')"""
new_label = old_label + """

  /* The account box's state line: with a known subscriber name it reads
     「已登录：name」; without one it is the plain signed-in copy. */
  const signedInLabel = status?.status === 'signed-in' && status.pat?.accountName !== undefined
    ? t('accountSignedInAs', { name: status.pat.accountName })
    : label"""
assert s.count(old_label) == 1, 'label anchor'
s = s.replace(old_label, new_label)

# ---- pane body: remove max-window checkbox & big heading; per-model select
old_models = """    <div className="qdp-list">
      <div className="qdp-modelHead">
        <h3 className="qdp-panelTitle">{t('modelsMergedHeading')}</h3>
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
      <p className="qdp-body">{t('modelsMergedHint')}</p>
      {catalog?.error === undefined ? null : <p className="qdp-error">{t('catalogError', { message: catalog.error })}</p>}
      {showPreference && onUseMaximumContextWindow !== undefined ? (
        <label className="qdp-contextPref">
          <input
            type="checkbox"
            checked={useMaximumContextWindow === true}
            disabled={busy}
            onChange={event => { onUseMaximumContextWindow(event.currentTarget.checked) }}
          />
          <span className="qdp-contextPrefCopy">
            <span>{t('useMaximumContextWindow')}</span>
            <span className="qdp-rate">{t('useMaximumContextWindowHint')}</span>
          </span>
        </label>
      ) : null}
      {list.length === 0 ? (
        <p className="qdp-body">{t('modelsNoModels')}</p>
      ) : (
        <div className="qdp-modelList">
          {list.map(model => {
            const isModelEnabled = !disabledModels.includes(model.id)
            const capacity = model.contextWindow
            const max = maxDeclaredWindow(model)
            const alternative = capacity !== undefined && max !== undefined && max > capacity ? max : undefined
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
                    <span className="qdp-modelName">{model.name}</span>
                    <span className="qdp-modelMeta">{model.id}</span>
                  </span>
                </label>
                <span className="qdp-contextPicker">
                  {capacity !== undefined ? <span className="qdp-modelMeta">{formatTokens(capacity)}</span> : null}
                  {alternative !== undefined
                    ? <span className="qdp-rate">{t('contextUpTo', { size: formatTokens(alternative) })}</span>
                    : model.defaultContextWindow !== undefined && capacity !== undefined && model.defaultContextWindow < capacity
                      ? <span className="qdp-rate">{t('contextDefault', { size: formatTokens(model.defaultContextWindow) })}</span>
                      : null}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}"""
new_models = """    <div className="qdp-list">
      <div className="qdp-modelHead">
        <h3 className="qdp-panelTitle">{t('tabModels')}</h3>
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
        <div className="qdp-modelList">
          {list.map(model => {
            const isModelEnabled = !disabledModels.includes(model.id)
            const capacity = model.contextWindow
            const max = maxDeclaredWindow(model)
            // The chooser offers the declared windows only; anything the
            // upstream did not declare is not selectable (never guessed).
            const choices = [...new Set([
              ...(model.supportedContextWindows ?? (capacity !== undefined ? [capacity] : [])),
              ...(capacity !== undefined ? [capacity] : []),
            ])].sort((a, b) => b - a)
            const effective = capacity ?? model.defaultContextWindow
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
                    <span className="qdp-modelName">{model.name}</span>
                    <span className="qdp-modelMeta">{model.id}</span>
                  </span>
                </label>
                <span className="qdp-contextPicker">
                  {choices.length > 0 ? (
                    <select
                      className="qdp-modelSelect"
                      value={effective !== undefined && choices.includes(effective) ? String(effective) : ''}
                      disabled={busy}
                      aria-label={`${model.name} ${t('contextHeading')}`}
                      onChange={event => { onSetModelContextWindow(model.id, Number(event.currentTarget.value)) }}
                    >
                      {effective !== undefined && !choices.includes(effective)
                        ? <option value="">{formatTokens(effective)}</option>
                        : null}
                      {choices.map(choice => (
                        <option key={choice} value={choice}>{formatTokens(choice)}</option>
                      ))}
                    </select>
                  ) : null}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}"""
assert s.count(old_models) == 1, 'models anchor'
s = s.replace(old_models, new_models)

# ModelsPane props: drop max-window, add per-model write
old_props = """function ModelsPane({ models, disabledModels = [], useMaximumContextWindow, catalog, t, busy, onUseMaximumContextWindow, onSetModelsEnabled, onRefreshModels }: {
  models: readonly QoderCatalogModelSnapshot[] | undefined
  disabledModels?: readonly string[] | undefined
  useMaximumContextWindow?: boolean | undefined
  catalog?: QoderWebCatalog | undefined
  t: QoderPluginCardInjected['t']
  busy?: boolean
  onUseMaximumContextWindow?: (enabled: boolean) => void
  onSetModelsEnabled: (models: readonly string[], enabled: boolean) => void
  onRefreshModels: () => void
}): React.ReactNode {
  const list = models ?? []
  const known = list
    .filter(model => model.contextWindow !== undefined)
    .sort((a, b) => (b.contextWindow as number) - (a.contextWindow as number))
  const canSelectMaximum = known.some(model => {
    const max = maxDeclaredWindow(model)
    return max !== undefined && max > (model.defaultContextWindow ?? model.contextWindow ?? 0)
  })
  const showPreference = onUseMaximumContextWindow !== undefined && (canSelectMaximum || useMaximumContextWindow === true)
  return ("""
new_props = """function ModelsPane({ models, disabledModels = [], catalog, t, busy, onSetModelContextWindow, onSetModelsEnabled, onRefreshModels }: {
  models: readonly QoderCatalogModelSnapshot[] | undefined
  disabledModels?: readonly string[] | undefined
  catalog?: QoderWebCatalog | undefined
  t: QoderPluginCardInjected['t']
  busy?: boolean
  onSetModelContextWindow: (model: string, window: number) => void
  onSetModelsEnabled: (models: readonly string[], enabled: boolean) => void
  onRefreshModels: () => void
}): React.ReactNode {
  const list = [...(models ?? [])].sort((a, b) => (b.contextWindow ?? 0) - (a.contextWindow ?? 0))
  return ("""
assert s.count(old_props) == 1, 'props anchor'
s = s.replace(old_props, new_props)

# call site: swap the props
old_call = """                  <ModelsPane
                    models={status.models}
                    disabledModels={status.disabledModels}
                    useMaximumContextWindow={status.useMaximumContextWindow}
                    catalog={status.catalog}
                    t={t}
                    busy={busy}
                    onUseMaximumContextWindow={(enabled: boolean) => { void control({ action: 'set-maximum-context-window', enabled }) }}
                    onSetModelsEnabled={(models, enabled) => {
                      void control({ action: 'set-models-enabled', models, enabled })
                    }}
                    onRefreshModels={() => { void refreshModels() }}
                  />"""
new_call = """                  <ModelsPane
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
                  />"""
assert s.count(old_call) == 1, 'call anchor'
s = s.replace(old_call, new_call)

# ---- (1)(6) settings flat on the Usage pane ------------------------------
old_settings = """          {/*
           * Quota sidebar settings: last and collapsed. They were the card's
           * FIRST block — seven controls gating the account content below —
           * and they are the least-touched surface the card owns.
           */}
          <CardSection title={t('quotaSettingsHeading')}>
            <QuotaSettingsContent t={t} scope={scope} signedIn={signedIn} />
          </CardSection>"""
new_settings = """          {/*
           * Sidebar & check-in settings render FLAT on the Usage pane — no
           * fold, no fold heading — and only the active variant's rows (the
           * CN tab shows CN settings, the Global tab Global settings).
           */}
          <div className="qdp-settingsFlat">
            <h3 className="qdp-settingsTitle">{t('quotaSettingsHeading')}</h3>
            <QuotaSettingsContent
              t={t}
              scope={scope}
              signedIn={signedIn}
              variant={isUnified ? (activeVariantId === 'qoder' ? 'cn' : 'global') : currentVariant.id === 'qoder' ? 'cn' : 'global'}
            />
          </div>"""
assert s.count(old_settings) == 1, 'settings anchor'
s = s.replace(old_settings, new_settings)

# settings only makes sense signed-in; keep it out of signed-out/error arms
# by moving it inside the signed-in fragment instead (it currently sits after).
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('body ok')
