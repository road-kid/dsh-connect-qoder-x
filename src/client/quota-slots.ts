/**
 * SlotMap merge for the quota panel's two seats — a structural re-statement of
 * commandcode's `panel-slots.ts`, which does the same for its own panel: the
 * layout's keyed `main` seat and the sidebar's footer-action list are declared
 * by packages this plugin does not depend on, so the slots are re-declared
 * here to make them type-check. Import this module (for its side effect) in
 * any file that registers or renders into either seat.
 *
 * The declarations must stay STRUCTURALLY IDENTICAL to upstream's: when a peer
 * package ships its own merge, a duplicate conflicting member would fail
 * compilation — the guard against drift.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * The layout's center-column panel registry. Declared by
     * `@deepseek-ai/dsh-client-ui-layout` (not a dependency of this bundle);
     * the sidebar footer card's `open()` selects a key from this registry.
     */
    'main': { kind: 'keyed'; scope: 'root' }
    /**
     * The sidebar-foot action list, rendered inside the foot area directly
     * ABOVE the Settings seat (`footArea` renders `footerActions` then
     * `settingsArea`). Declared by `@deepseek-ai/dsh-client-ui-sidebar`; the
     * owner passes only the column state.
     */
    'sidebar.footer.action': { kind: 'list'; scope: 'root'; owner: SidebarFooterActionOwnerProps }
    /**
     * The Plugins page's row-configuration seat, declared by
     * `@deepseek-ai/dsh-client-ui-plugin-manager` (not a dependency of this
     * bundle). It is a KEYED slot dispatched with `entryKey = <package
     * name>#<row id>`; hitting it is what puts a 「配置」 control on this
     * plugin's row in the Plugins page and opens this card as that row's page.
     *
     * This is the 0.1.7 replacement for the removed `settings.plugin.item` /
     * community `plugin-settings.item` seats: plugin configuration now lives
     * on the plugin's own page, reached by clicking the plugin's name, rather
     * than in a Settings navigation section.
     */
    'plugins.row.config': { kind: 'keyed'; scope: 'root'; owner: PluginConfigViewOwnerProps }
    /**
     * The Plugins page's bundle-configuration seat, same owner package, keyed
     * by BUNDLE NAME alone. Rendered inline on the package detail page between
     * the description and the row list — the second way into the same card for
     * a reader who opened the package itself rather than the row.
     */
    'plugins.bundle.config': { kind: 'keyed'; scope: 'root'; owner: PluginConfigViewOwnerProps }
  }
}

/** Owner share of a sidebar footer action: only the column display state. */
export interface SidebarFooterActionOwnerProps {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
}

/**
 * Owner share of both plugin-configuration seats, mirrored structurally from
 * `ui-plugin-manager`'s `PluginConfigViewProps`.
 *
 * `view` is the contract: `summary` asks for the one-liner the card list shows
 * (and the fallback for a row with no description), `page` asks for the
 * configuration body rendered inside the detail page — where the OWNER already
 * draws the title, icon, and breadcrumb, so a registrant must not draw its own
 * heading or disclosure chrome.
 *
 * `form` (the host-owned config form for the entry) is deliberately not
 * declared: this plugin serves its own configuration over its own loopback
 * route, so it never reads the host's form. A different shape from the
 * owner's is harmless — the owner only ever passes it through.
 */
export interface PluginConfigViewOwnerProps {
  /** Which face of the card the page asks for. */
  view: 'summary' | 'page'
}
