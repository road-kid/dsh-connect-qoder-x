/**
 * Stylesheet for the Qoder quota surfaces (the sidebar footer card and the
 * dashboard it opens) — a direct translation of commandcode's panel stylesheet
 * (src/client/panel-styles.ts), which the user held up as the reference look.
 * Classes are `qdp-` prefixed to stay clear of commandcode's `ccp-` set: both
 * plugins inject GLOBAL CSS into the same document, so the prefixes must not
 * collide.
 *
 * Same contract as the original: returned as a string (no DOM side effects at
 * import time), installed once by the client entry keyed by `data-plugin-css`,
 * and removed when the plugin's fiber unwinds. Every colour comes from a
 * harness theme alias with a neutral fallback.
 */

/** Stylesheet id (the `data-plugin-css` value that makes injection idempotent). */
export const QUOTA_CSS_ID = 'dsh-connect-qoder-x/QuotaPanel.module.css'

/** Install the stylesheet once; returns its disposer. */
export function injectQuotaCss(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (document.querySelector(`style[data-plugin-css="${QUOTA_CSS_ID}"]`) !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-connect-qoder-x'
  tag.dataset.pluginCss = QUOTA_CSS_ID
  tag.textContent = QUOTA_CSS
  document.head.appendChild(tag)
  return () => {
    tag.remove()
  }
}

/** The quota panel stylesheet. */
export const QUOTA_CSS = `
/* ------------------------------------------------- sidebar footer card */
/* The shell's foot area renders this list ABOVE the Settings seat. The shell
   supplies no chrome: the entry is the button. Deliberately quiet — a surface
   beside Settings should read as part of the column — one hover step and a
   hairline border, exactly like commandcode's card.

   The shell's container is a flex ROW whose occupants each declare a
   full-width line, so as a row it overflows the column. The fix is the same
   load-bearing anchored rule commandcode ships (their issue #48): force the
   sidebar's footer-action container into a column, anchored to "_footArea"
   because "footerActions" is also used by the ask-user-question dialog — an
   unanchored rule would stack THAT dialog's buttons too. Anchoring keeps the
   fix scoped to the sidebar; the descendant combinator survives a wrapper
   appearing between the two. The rule is idempotent when commandcode is also
   installed (same selector, same declaration) and makes this plugin
   self-sufficient when it is not. */
[class*="_footArea"] [class*="_footerActions"]{flex-direction:column}
.qdp-foot{box-sizing:border-box;flex:0 0 auto;width:100%;min-width:0;font:inherit;color:var(--dsw-alias-label-secondary);text-align:left;cursor:pointer;background:0 0;border:1px solid transparent;border-radius:10px;flex-direction:column;gap:6px;margin:0 0 4px;padding:8px;display:flex}
.qdp-foot:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}
.qdp-foot:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-footTop{align-items:center;gap:8px;min-width:0;display:flex}
.qdp-footName{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;font-size:13px;font-weight:500;line-height:20px}
.qdp-updated{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px;font-variant-numeric:tabular-nums;white-space:nowrap}
/* One block per merged package group: a head line carrying the group's own
   remain/total, then the FULL-WIDTH bar under it. Stacking the two lets the
   card show the figures — the reason this surface exists — without squeezing
   the bar into what is left beside them. */
.qdp-footRow{flex-direction:column;gap:4px;min-width:0;display:flex}
.qdp-footHead{align-items:baseline;gap:8px;min-width:0;display:flex}
.qdp-footLabel{flex:1;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qdp-footAmount{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
/* The card's markup must stay PHRASING content — it renders inside the shell's
   own button — so these bars are spans, not divs. display:block is
   load-bearing on BOTH: an inline box ignores width and height outright, so
   without it the fill collapses to 0x0 and the bar shows no usage. */
.qdp-footBar{display:block;background:var(--dsw-alias-bg-layer-2);border-radius:999px;height:5px;overflow:hidden}
.qdp-footFill{display:block;background:var(--dsw-alias-brand-primary);border-radius:999px;height:100%;transition:width .3s ease}
.qdp-footFillWarn{background:var(--dsw-alias-state-error-primary)}
.qdp-footPct{flex:none;width:34px;color:var(--dsw-alias-label-secondary);text-align:right;font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}

/* The 56px rail: one icon button on the shell's own rail geometry (36px cell),
   so the collapsed column keeps a single glyph like its siblings. */
.qdp-railButton{box-sizing:border-box;width:36px;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:1px solid transparent;border-radius:8px;flex:none;justify-content:center;align-items:center;margin:0 0 4px;padding:0;display:inline-flex}
.qdp-railButton:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.qdp-railButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}

/* The ring glyph. Sized entirely by its own width/height attribute, so the
   footer row and the rail button can each ask for their own. */
.qdp-glyph{flex:none;justify-content:center;align-items:center;display:inline-flex;color:var(--dsw-alias-brand-primary)}
.qdp-ringWarn{color:var(--dsw-alias-state-error-primary)}

/* Pure-CSS caret for the card's collapsible sections. The host primitives'
   chevron icon names differ per DSH line, so no static import can serve both —
   a border caret in the plugin's own CSS is version-proof (workbuddy's
   approach, restated under this plugin's qdp- prefix). */
.qdp-chevron{flex:none;width:16px;height:16px;position:relative;transition:transform .16s}
.qdp-chevron::before{content:"";display:block;position:absolute;left:4px;top:5px;width:7px;height:7px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(45deg)}
.qdp-chevronOpen{transform:rotate(180deg)}

/* ------------------------------------------------------------ dashboard */
/* The center column in the layout frame: fill it, scroll the content column,
   and cap the reading width like the harness's own panels. */
.qdp-main{background:var(--dsw-alias-bg-layer-1);width:100%;height:100%;overflow:auto;display:block}
.qdp-mainInner{max-width:760px;margin:0 auto;padding:24px 20px 40px;flex-direction:column;gap:14px;display:flex;color:var(--dsw-alias-label-primary)}
.qdp-header{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.qdp-headerText{flex-direction:column;gap:2px;display:flex;min-width:0}
.qdp-title{margin:0;font-size:18px;font-weight:600;line-height:1.4}
.qdp-subtitle{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.qdp-spacer{flex:1}
.qdp-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;font-variant-numeric:tabular-nums}
/* The dashboard's exit: an icon-sized glyph button. */
.qdp-close{min-width:28px;justify-content:center;padding-left:0;padding-right:0;box-sizing:border-box;align-items:center;cursor:pointer;font:inherit;color:var(--dsw-alias-label-secondary);background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;height:28px;display:inline-flex}
.qdp-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.qdp-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-close span{font-size:16px;line-height:1}
.qdp-refresh{box-sizing:border-box;align-items:center;cursor:pointer;font:inherit;color:var(--dsw-alias-label-secondary);background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:4px 12px;display:inline-flex;gap:6px;font-size:12px;line-height:18px}
.qdp-refresh:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.qdp-refresh:disabled{opacity:.5;cursor:default}
.qdp-refresh:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}

/* Notices: signed-out and error states. */
.qdp-notice{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:12px 14px;flex-direction:column;gap:4px;display:flex}
.qdp-noticeError{border-color:var(--dsw-alias-state-error-primary)}
.qdp-noticeTitle{margin:0;font-size:13px;font-weight:600;line-height:1.5}
.qdp-noticeHint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}

/* One card per variant. */
.qdp-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:14px;padding:16px 18px;flex-direction:column;gap:16px;display:flex}
.qdp-cardHead{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.qdp-avatar{flex:none;width:28px;height:28px;color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform);border-radius:50%;justify-content:center;align-items:center;font-size:12px;font-weight:600;line-height:1;display:inline-flex}
.qdp-cardIdentity{flex-direction:column;gap:1px;min-width:0;display:flex}
.qdp-cardTitle{font-size:13px;font-weight:600;line-height:1.4}
.qdp-cardOwner{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}

/* Quota blocks: each merged group is a label row plus the track. */
.qdp-windows{flex-direction:column;gap:14px;display:flex}
.qdp-window{flex-direction:column;gap:6px;display:flex}
.qdp-windowHead{align-items:baseline;gap:8px;display:flex}
.qdp-windowLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:1.5}
.qdp-windowValue{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums;white-space:nowrap}
.qdp-windowPct{color:var(--dsw-alias-label-primary);min-width:38px;text-align:right;font-size:12px;font-weight:600;line-height:1.5;font-variant-numeric:tabular-nums}
.qdp-bar{overflow:hidden;background:var(--dsw-alias-bg-layer-1);border-radius:999px;height:8px}
.qdp-barFill{background:var(--dsw-alias-brand-primary);border-radius:999px;height:100%;transition:width .3s ease}
.qdp-barFillWarn{background:var(--dsw-alias-state-error-primary)}
.qdp-windowReset{color:var(--dsw-alias-label-tertiary);margin:0;font-size:11px;line-height:1.5}

/* Badges. */
.qdp-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-brand-primary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600;line-height:17px}
.qdp-badgeError{background:transparent;color:var(--dsw-alias-state-error-primary)}
.qdp-badgeMuted{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px;max-width:220px;overflow:hidden;text-overflow:ellipsis}

/* Overall remaining + share line, ahead of the detail table. */
.qdp-totalLine{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.qdp-totalValue{font-size:22px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;margin-left:6px}
.qdp-totalSub{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums}

/* Detail table: every package, unmerged. Column heads are the settings
   shell's tertiary smallcaps; numbers are tabular; the mini bar rides under
   the figures in the same cell like the reference layout. */
.qdp-table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.qdp-table th{text-align:left;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:600;line-height:1.5;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--dsw-alias-border-l2);padding:4px 8px}
.qdp-table td{padding:7px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);vertical-align:top}
.qdp-table tr:last-child td{border-bottom:0}
.qdp-num{min-width:150px}
.qdp-numText{display:block;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin-bottom:3px}
.qdp-miniBar{display:block;height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.qdp-expiry{white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}

/* Variant switch: plain buttons, like the settings page's usage carousel. */
.qdp-tabs{flex-wrap:wrap;gap:6px;display:flex}
.qdp-tab{align-items:center;font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 10px;font-size:12px;line-height:18px;display:inline-flex;gap:6px}
.qdp-tab:hover:not(.qdp-tabActive){color:var(--dsw-alias-label-primary)}
.qdp-tabActive{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}

/* ------------------------------------------------- plugin card */
/* The Plugins-page configuration card. One rule set replaces the card's
   ~30 inline CSSProperties objects: same declarations, but themeable in one
   place, shareable between the unified card and any future surface, and
   free of the per-object fallback drift (identical rgba hexes had been
   restated by hand across objects). Dynamic values — progress widths,
   active-tab state, status-dot colour — stay inline on the element. */
.qdp-card{list-style:none;border-width:.5px;border-style:solid;border-color:var(--dsw-alias-border-l4);border-radius:16px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}
.qdp-card:hover{border-color:var(--dsw-alias-label-dimmed)}
.qdp-cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
/* The disclosure header, shaped like workbuddy's .dsm-plugin-card-header:
   one full-width button so the whole row toggles, with the icon and the
   two-line title block on the left and the caret pushed right. */
.qdp-cardHeader{align-items:flex-start;gap:12px;width:100%;padding:14px 16px;border:0;background:none;color:inherit;cursor:pointer;text-align:left;display:flex}
.qdp-cardHead{flex-direction:column;align-items:flex-start;gap:4px;flex:1;min-width:0;display:flex}
.qdp-cardTitle{font-size:15px;line-height:1.4;font-weight:600;color:var(--dsw-alias-label-primary);text-align:left}
.qdp-cardDescription{font-size:13px;line-height:1.45;color:var(--dsw-alias-label-tertiary);text-align:left}
.qdp-cardIcon{flex:none;width:32px;height:32px;border-radius:7px;display:block}
/* A border-drawn caret rather than a host icon: the icon primitive's names
   differ across DSH lines (0.1.5 Outline14 vs 0.1.7 OutlineRegular), so no
   single static import serves both — the same reason workbuddy draws its own. */
.qdp-cardChevron{flex:none;width:9px;height:9px;margin-right:4px;border-right:1.5px solid var(--dsw-alias-label-tertiary);border-bottom:1.5px solid var(--dsw-alias-label-tertiary);transform:rotate(45deg);transition:transform .16s}
.qdp-cardChevronOpen{transform:rotate(225deg)}
/* No border-top: the host already draws a rule under the header row, so one
   here read as a second, doubled line across the card (and looked like an
   outer box around the panes). The rule belongs to whoever draws the header. */
.qdp-cardBody{margin:0 16px;padding:12px 0 8px;display:flex;flex-direction:column;gap:18px}
.qdp-h3{margin:0;font-size:13px;line-height:1.5;font-weight:600;color:var(--dsw-alias-label-primary)}
.qdp-body{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.qdp-error{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}
.qdp-row{align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;display:flex}
.qdp-status{align-items:center;gap:8px;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary);display:flex}
.qdp-list{flex-direction:column;gap:18px;padding-top:2px;display:flex}
.qdp-group{flex-direction:column;gap:10px;display:flex}
.qdp-label{justify-content:space-between;gap:12px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:flex}
.qdp-rate{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
/* Buttons. Primary fills the row's main action; danger is graded: quiet
   outline while armed, solid error fill once confirmed. */
.qdp-btn{box-sizing:border-box;padding:5px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1.5;cursor:pointer}
.qdp-btn:disabled{opacity:.4;cursor:default}
.qdp-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-btnPrimary{border-color:var(--dsw-alias-button-primary-fill);background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.qdp-btnDanger{border-color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-label-primary-foreground)}
.qdp-btnDangerQuiet{color:var(--dsw-alias-state-error-primary)}
/* PAT entry row and its input. */
.qdp-patRow{align-items:center;gap:8px;flex-wrap:wrap;display:flex}
.qdp-patInput{box-sizing:border-box;flex:1;min-width:200px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.5}
/* Collapsible section inside the card body. */
.qdp-section{flex-direction:column;border-top:1px solid var(--dsw-alias-border-l2);padding-top:10px;display:flex}
.qdp-sectionHeadRow{align-items:center;gap:8px;display:flex}
.qdp-sectionHead{font:inherit;color:var(--dsw-alias-label-secondary);text-align:left;cursor:pointer;background:0 0;border:0;padding:4px 0;align-items:center;gap:8px;display:flex}
.qdp-sectionHead:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-sectionTitle{font-size:13px;font-weight:600;line-height:1.5}
.qdp-sectionActions{align-items:center;gap:6px;margin-left:auto;display:flex}
.qdp-sectionBody{flex-direction:column;gap:12px;padding-top:10px;display:flex}
/* The one level of variant tabs. */
.qdp-seg{align-items:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:3px;gap:4px;display:flex}
.qdp-segItem{flex:1;align-items:center;justify-content:center;gap:8px;border:1px solid transparent;border-radius:6px;padding:6px 12px;font:inherit;font-size:13px;line-height:18px;cursor:pointer;appearance:none;outline:none;color:var(--dsw-alias-label-tertiary);transition:all .16s ease;display:flex}
.qdp-segItem:hover{color:var(--dsw-alias-label-primary)}
.qdp-segItem:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-segItemActive{border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font-weight:500}
/* Context preference + model rows. */
.qdp-contextPref{align-items:flex-start;gap:9px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5;padding:10px 12px;display:flex}
.qdp-contextPrefCopy{flex-direction:column;gap:2px;display:flex}
.qdp-contextPicker{align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;display:flex}
/* Column headings for the model list, sitting on the divider the user drew
   above the list: the rule separates the refresh toolbar from the list, and
   the two captions name the columns the rows are laid out in. */
.qdp-modelColumns{border-top:.5px solid var(--dsw-alias-border-l2);align-items:center;justify-content:space-between;gap:12px;padding:8px 12px 6px;display:flex;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
/* Model rows as one framed list: rows are separated by hairlines INSIDE a
   single rounded frame (workbuddy's list shape) rather than each being its
   own filled chip, which read as a stack of unrelated boxes. The frame owns
   the radius and the border; the rows own the dividers. */
.qdp-modelList{border:.5px solid var(--dsw-alias-border-l4);border-radius:10px;background:var(--dsw-alias-bg-layer-3);overflow:hidden}
.qdp-modelRow{align-items:flex-start;justify-content:space-between;gap:12px;background:none;border-radius:0;padding:10px 12px;display:flex}
.qdp-modelRow + .qdp-modelRow{border-top:.5px solid var(--dsw-alias-border-l2)}
/* The row's left half: the visibility checkbox plus the two-line name/id
   block. These classes were referenced by the card from the start but never
   had rules, so the block rendered with browser defaults; stated properly
   here as part of the framed-list restyle. */
.qdp-modelEnable{align-items:center;gap:9px;flex:1;min-width:0;cursor:pointer;display:flex}
.qdp-modelEnable input{flex:none;margin:0;cursor:pointer}
.qdp-modelCopy{flex-direction:column;gap:1px;min-width:0;display:flex}
.qdp-modelName{font-size:13px;line-height:1.4;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The per-model window slider, shaped like Qoder's own control: a light
   green wash filling the groove up to a slim green bar handle. Green here is
   the success tone Qoder uses for this control, not the blue brand fill. */
.qdp-windowSlider{flex-direction:column;gap:4px;flex:none;width:170px;display:flex}
.qdp-windowTrack{position:relative;height:18px;display:flex;align-items:center}
.qdp-windowTrack::before{content:"";position:absolute;left:0;right:0;height:8px;border-radius:3px;background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l2)}
/* The wash runs from the left edge to the handle, so the travel in effect
   reads at a glance even when the handle sits at stop 0. */
.qdp-windowFill{position:absolute;left:0;height:8px;border-radius:3px;background:var(--dsw-alias-state-success-primary,#3e8e5a);opacity:.22}
/* The handle is a slim vertical bar (Qoder's), not a round dot. It is inset
   by half its width so stop 0 sits ON the left edge instead of hanging half
   outside the track — which is what made it look unrendered at 0. */
.qdp-windowKnob{position:absolute;width:4px;height:16px;border-radius:2px;background:var(--dsw-alias-state-success-primary,#3e8e5a);transform:translateX(-2px)}
.qdp-windowInput{position:absolute;left:0;right:0;width:100%;height:18px;margin:0;opacity:0;cursor:pointer;-webkit-appearance:none;appearance:none}
.qdp-windowInput:disabled{cursor:default}
.qdp-windowTicks{position:relative;height:14px;font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.qdp-windowTick{position:absolute;transform:translateX(-50%);white-space:nowrap}
/* The origin marker: the track starts at 0 for every model, and the user
   asked for that start to be visible without printing the number 0. */
.qdp-windowTickMark{display:inline-block;width:1px;height:4px;background:var(--dsw-alias-border-l4)}
.qdp-windowValue{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.qdp-track{height:8px;overflow:hidden;border-radius:999px;background:var(--dsw-alias-bg-layer-2)}
.qdp-checkinRow{align-items:center;padding:6px 0;font-size:13px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex}
.qdp-checkinHead{border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:6px;font-size:12px;color:var(--dsw-alias-label-tertiary);display:flex}
.qdp-logList{flex-direction:column;gap:6px;display:flex}
/* Usage & check-in panel: one bordered surface, usage above a divider,
   check-in below (workbuddy's credit-panel shape, restated for qdp-). */
.qdp-panel{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:14px;gap:12px;display:flex;flex-direction:column}
.qdp-panelDivide{border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px}
.qdp-panelHead{align-items:baseline;justify-content:space-between;gap:12px;display:flex}
.qdp-panelTitle{margin:0;font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary)}
.qdp-panelMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;font-variant-numeric:tabular-nums}
.qdp-checkinLine{align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;display:flex}
.qdp-checkinState{align-items:center;gap:8px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:flex;min-width:0}
/* Bottom tab strip: two panes side by side, an underline marks the active
   one. Quiet pills would compete with the panel headings above. */
.qdp-paneTabs{gap:18px;border-bottom:1px solid var(--dsw-alias-border-l2);margin-top:2px;display:flex}
.qdp-paneTab{font:inherit;font-size:13px;line-height:20px;cursor:pointer;background:0 0;border:0;border-bottom:2px solid transparent;color:var(--dsw-alias-label-tertiary);padding:6px 2px;margin-bottom:-1px}
.qdp-paneTab:hover{color:var(--dsw-alias-label-primary)}
.qdp-paneTab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-paneTabActive{border-bottom-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);font-weight:600}
/* The merged model pane: header row carries the refresh control; each row
   states its own context capacity beside the enable toggle. */
.qdp-modelHead{align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;display:flex}
.qdp-modelMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;white-space:nowrap}
/* Per-model context picker: a compact select like workbuddy's account
   picker, sharing the select-wrap caret pattern. */
/* Variant tabs with an enable checkbox per side (workbuddy tab-switch). */
.qdp-segCell{align-items:center;gap:2px;flex:1;min-width:0;display:flex}
.qdp-segSwitch{display:inline-flex;align-items:center;flex:none;padding:0 8px 0 2px;cursor:pointer}
.qdp-segSwitch input{margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary)}
.qdp-segSwitch input:disabled{opacity:.4;cursor:default}
.qdp-segOff{opacity:.55}
/* Account box + PAT box (workbuddy usage-account shape). */
.qdp-accountBox{align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-2);padding:12px 14px;display:flex}
.qdp-accountState{align-items:center;gap:10px;font-size:15px;font-weight:500;color:var(--dsw-alias-label-primary);display:flex}
.qdp-accountExpiry{padding-left:19px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.qdp-patBox{align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-3);padding:8px 12px;display:flex}
.qdp-patBoxCopy{flex-direction:column;gap:1px;min-width:0;display:flex}
.qdp-patBoxName{color:var(--dsw-alias-label-primary);font-size:12px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qdp-patBoxMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}
/* Settings listed flat on the Usage pane: no fold, just grouped rows. */
.qdp-settingsFlat{border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px;gap:4px;display:flex;flex-direction:column}
.qdp-settingsTitle{margin:0;font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary)}
/* 可用额度与最近领取并列两栏:workbuddy 的 credit-panels 布局,窄屏回落单列。 */
.qdp-twoUp{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:stretch;display:grid}
@media (max-width:760px){.qdp-twoUp{grid-template-columns:1fr}}
/* 领取台账的一行:左边日期,右边到期情况(与需求 4 的排版一致)。 */
.qdp-ledgerRow{align-items:baseline;justify-content:space-between;gap:10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);display:flex}
/*
 * 台账本体占满左框的剩余高度,超出就滚动而不是把框撑长(需求 1:
 * 界面能显示几条显示几条)。行高 18px + 行距 6px,9 行 ≈ 216px;
 * 底部的「3 天内到期」小结只占自己一行,高度都留给上面的列表。
 */
.qdp-ledgerList{max-height:216px;overflow-y:auto}
.qdp-ledgerDate{color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-variant-numeric:tabular-nums}
.qdp-ledgerAmount{flex:none;color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}
.qdp-ledgerExpiry{margin-left:auto;color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-variant-numeric:tabular-nums}
.qdp-ledgerExpired{color:var(--dsw-alias-state-error-primary)}
/* 右侧额度框里的领取按钮:占满整行、贴在剩余额度/进度下面(需求 4)。 */
.qdp-claimBtn{width:100%;justify-content:center}
/* 左框底部的到期小结行,与它上面的台账行用一条分隔线断开。 */
.qdp-ledgerFoot{border-top:1px solid var(--dsw-alias-border-l2);padding-top:10px;align-items:baseline;justify-content:space-between;gap:10px;display:flex}
.qdp-ledgerFootValue{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}

@media (prefers-reduced-motion:reduce){.qdp-footFill,.qdp-barFill{transition:none}}
`
