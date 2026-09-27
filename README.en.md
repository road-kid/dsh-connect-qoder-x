# DSH Qoder Connect X

**English** | [简体中文](./README.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin that brings your **Qoder subscription** models into DSH through a Personal Access Token (PAT). One plugin serves both Qoder product lines — each with its own provider id, credential file and saved catalog, never mixed:

| Variant | Provider id | Where the PAT is minted |
|---|---|---|
| China (国内版) | `qoder` | qoder.com.cn |
| International (国际版) | `qoder-global` | qoder.com |

Configure only what you use: a variant with no saved PAT shows no model group and never interferes with the other one. Streaming, reasoning content and tool calls ride the plugin's built-in Qoder transport; the conversation loop, compaction and permissions stay Harness-owned.

---

## What this repository is

This is a **fork** of [masknull/dsh-qoder-connect](https://github.com/masknull/dsh-qoder-connect) (`dsh-qoder-connect`), renamed to `dsh-connect-qoder-x`.

**Why fork.** Upstream 0.2.0 registers its settings UI on slot names DSH 0.1.7 no longer uses, which left the settings page with no entry point from the Plugins page at all — it hung off an orphaned `Settings → 插件设置` nav entry. This fork ports it onto the 0.1.7 plugin-configuration seats and **renames the package, the plugin and the profile row id** so it can be installed **alongside upstream in the same profile** without either overwriting the other. Mechanics: [Porting notes](#porting-notes-the-017-plugin-configuration-seats).

**Relationship to upstream.** The `upstream` remote points at `masknull/dsh-qoder-connect`; this fork's changes live on the `feat/port-to-dsh-0.1.7-plugin-config` branch.

```sh
git remote -v
# origin    https://github.com/road-kid/dsh-connect-qoder-x.git
# upstream  https://github.com/masknull/dsh-qoder-connect.git

# Track upstream
git fetch upstream
git merge upstream/main
```

**Name mapping** (what keeps the two installs apart):

| Item | Upstream `dsh-qoder-connect` | This fork `dsh-connect-qoder-x` |
|---|---|---|
| Package name | `dsh-qoder-connect` | `dsh-connect-qoder-x` |
| Profile row id | `llm-qoder` | `llm-qoder-x` |
| Data directory | `<profile>/.dsh-qoder-connect/` | `<profile>/.dsh-connect-qoder-x/` |
| HTTP route prefix | `/plugins/dsh-qoder-connect/*` | `/plugins/dsh-connect-qoder-x/*` |
| CLI command | `dsh-qoder-connect` | `dsh-connect-qoder-x` |

> **The two data directories are independent.** This fork does **not** read upstream's PATs, catalog or check-in history. Migrating means pasting the PAT again (or copying upstream's `.qoder-auth.json` to `.dsh-connect-qoder-x/.qoder-auth.json` by hand).

---

## Features

- **PAT: save it and it works** — paste a PAT into the settings card and press *Save*; the token is validated live against that variant's region before anything is written, and the model group appears immediately — no DSH restart. Once signed in, *Replace PAT* (the new token overwrites only after it validates, so a mistyped paste can never strand a working credential) and *Clear PAT* are one click away.
- **Two independent variants** — `qoder` (china) and `qoder-global` (global) keep separate credential files, routes and saved catalogs: a token minted on qoder.com does not work against the China deployment and vice versa.
- **Three-tier model catalog (live → saved → fallback)** — the card states where the list on screen came from: *“Model list updated …”* (fetched now), *“Showing the saved model list from …”* (this account's last successful fetch, restored after a restart or a failed fetch), or *“Showing the built-in model list (not yet updated from Qoder)”* (the roster compiled into the plugin). The reason of the most recent failed fetch is shown too, and a *Refresh model list* button sits right there.
- **One-toggle context window** — each variant card's *Context window* tab lists every model's capacity (the default and the largest declared window) and carries its own *“Use the largest declared context window”* preference (on by default): on, requests declare the maximum (e.g. Qwen3.8-Max at 1M); off, the default (200K). The two variants keep independent toggle state.
- **Model visibility toggles & batch controls** — each variant card provides a dedicated *Model Toggles* tab to freely enable or hide individual models; disabled models are hidden from the DSH model picker, keeping it tidy; includes instant search by name/ID and one-click *Enable all* / *Disable all* batch operations.
- **Daily auto check-in & logs** — claims the daily 100 Credits automatically, **at a time you can set per variant on the card** (10:00 UTC+8 by default, the upstream's reset moment), with independent toggles and startup catch-up protection. The card features a dedicated *Check-in log* panel with audit trails, *Check in now*, *Refresh*, and *Clear logs* quick actions.
- **Sidebar quota card + credit details** — the sidebar-display settings toggle a per-variant quota widget (off by default; each toggle needs its variant's PAT saved) with one shared refresh interval (default 5 min, minimum 1 min). Clicking the sidebar widget opens the *Qoder quota* panel: one row per credit package — *“Remaining / Total + bar | Expires”* — plus the cycle share and reset time. Click the same widget again to close; click the other to switch variants.
- **Rate display `x<priceFactor>`** — each model name is suffixed with the upstream-reported price multiplier (e.g. `Some Model · x0.79`, free is `x0`), spelled `x<n>` from the catalog's `price_factor`. Display only — it never changes the request; models whose rate the upstream did not report simply show no suffix.

---

## Where to find the settings UI

DSH 0.1.7 gathers every plugin's configuration into the **Plugins page**. This plugin's settings have **two entry points**, both rendering the same card:

1. **Row configuration (primary)** — sidebar *Plugins* → click the **DSH Qoder Connect X** card to open the package page → find the row `llm-qoder-x` and click its **Configure** control.
2. **Bundle configuration (secondary)** — sidebar *Plugins* → click the **DSH Qoder Connect X** card → the settings body renders **inline** under the package description.

The card no longer draws its own disclosure shell (the page supplies the title, the icon and the breadcrumb). Its internal China/Global switcher and its Status, Context window, Model toggles, Credit details and Check-in log tabs are unchanged.

> **Upgrading from an older version:** before 0.1.7 this plugin's settings lived under *Settings → 插件设置*. That entry is now **removed** — it was an artifact of the retired slot, not a real DSH navigation item.

---

## Install

Prerequisites:

- DSH core **`>=0.1.7-rc.1 <0.2.0`**;
- Node.js `^22.19.0 || >=24.0.0` (per `package.json` engines);
- your own Qoder account and at least one Personal Access Token.

> **Supported version range (narrower than upstream — please read)**
>
> Upstream `dsh-qoder-connect` spans **two host lines**: 0.1.5/0.1.6 through
> `settings.plugin.item` and 0.1.7 through the shared `plugin-settings.item`.
> This fork was rewritten against the 0.1.7 seats, so it supports **0.1.7 and
> later only** — a deliberate trade-off of the port, not a defect.
>
> On **0.1.5 / 0.1.6**: the **host half keeps working** (models, PAT, catalog,
> check-in), but **the settings card does not appear**, because those versions
> have no `plugins.row.config` seat. Use upstream if you need the older line.
>
> The floor is declared through the `@deepseek-ai/dsh-*` `peerDependencies`
> ranges — the field DSH actually validates at install time. `app-boot`'s
> compatibility preflight reads peer dependencies only; it does not read
> `engines.dsh`.

```sh
# From GitHub
dsh plugin --profile web add github:road-kid/dsh-connect-qoder-x
```

Swap the `--profile` value for the profile you use (`web` / `desktop` / `tui`) — data stays inside that profile, so web / desktop / tui never collide.

> **This fork and upstream can be installed at the same time**: package name, row id, routes and data directory all differ, so neither configuration touches the other. Remove upstream once you no longer need it: `dsh plugin --profile web remove dsh-qoder-connect`.

---

## Configuration

### Mint a PAT

- **Qoder (China)**: sign in at qoder.com.cn → account settings → Personal Access Token, then copy it. [Open the page](https://qoder.cn/account/integrations)
- **Qoder Global**: sign in at qoder.com → account settings → Personal Access Token, then copy it. [Open the page](https://qoder.com/account/integrations)

### Save it on the card

Open the settings UI by the path above, paste the PAT into the password field and press *Save* (*“Validating and saving…”* while it runs). The token is validated against that variant's region first — a refusal saves nothing and the card says *“That PAT was rejected — generate a new one in your account settings and try again.”*. Do this on both cards to run both groups side by side.

### Environment-variable fallback

For headless setups, the plugin reads an environment fallback **only when no credential file exists**:

| Variant | Environment variable |
|---|---|
| `qoder` (china) | `QODER_CN_PERSONAL_ACCESS_TOKEN` |
| `qoder-global` | `QODER_PERSONAL_ACCESS_TOKEN` |

The precedence is **file > env**: as soon as a valid credential file is saved, a stray environment token stops mattering.

---

## Data & privacy

### File layout

Everything the plugin owns lives in one data directory: `<profile>/.dsh-connect-qoder-x/` — credentials at the root, rebuildable caches under `state/` (so “clear the cache” can never touch a credential):

```text
<profile>/.dsh-connect-qoder-x/
├── .qoder-auth.json              # China PAT ({version:2, pat, region, savedAt})
├── .qoder-global-auth.json       # Global PAT
├── settings.json                 # sidebar display / check-in time and other own config
├── checkin-status.json           # check-in status and history logs
└── state/
    ├── .qoder-catalog.json       # China per-account saved catalog
    ├── .qoder-global-catalog.json
    ├── .qoder-probe.json         # China reasoning-effort probe records
    ├── .qoder-global-probe.json
    ├── .qoder-host-heartbeat.json
    └── .qoder-machine-id
```

`DSH_QODER_DATA_DIR` overrides the directory explicitly.

---

## Porting notes: the 0.1.7 plugin-configuration seats

Upstream 0.2.0 registered its settings under `settings.section`, in a `plugin-settings.item` child slot it declared itself — a private convention the three connect plugins once shared. What 0.1.7 actually has:

- `settings.section`'s children are exactly `settings.general.item`, `settings.plugins.tab`, `settings.models.provider-card` and `settings.models.footer` — **there is no** `plugin-settings.item`;
- the Built-in plugins page became a **tab container** (it reads only `settings.plugins.tab`), and the old `settings.plugin.item` entry was **deleted** from the `SlotMap`;
- plugin configuration moved to **keyed slots** owned by `ui-plugin-manager`.

So upstream's card ended up an **island with no way in**. This fork registers:

| Slot | Key | Effect |
|---|---|---|
| `plugins.row.config` | `dsh-connect-qoder-x#llm-qoder-x` | the row gains a *Configure* control that opens this card |
| `plugins.bundle.config` | `dsh-connect-qoder-x` | the same card renders inline on the package page |

The row key is `` `${package name}#${row id}` ``, and the row id is the `id` this plugin's patch declares. **That is why this fork renames the package and the row id together** — the two of them compose that key.

The card component follows the owner's `view` contract accordingly:

- `view === 'summary'` → the one-liner alone (the card row's description)
- `view === 'page'` → the settings body, drawing **no title and no disclosure shell** of its own

---

## Development

```sh
pnpm install
pnpm run build      # tsdown → lib/ (host bundle + client bundle)
pnpm test           # vitest run (tests/**/*.spec.ts)
pnpm run test:qoder # node --test (tests/qoder/*.test.ts, the Qoder transport suite)
pnpm run typecheck  # tsc across the host and client tsconfigs
pnpm run check      # typecheck + test + test:qoder + build in one gate
```

> **Known issue (inherited from upstream, unrelated to this port):** some cases in `tests/reasoning-merge.spec.ts` and `tests/settings-integration.spec.ts` fail on a pristine upstream snapshot (`631be5c`) as well — the former hangs in `boot()` until it times out. Reproduced independently on the untouched upstream tree, so it is not introduced here.

---

## Provenance & license

This repository is a fork of [masknull/dsh-qoder-connect](https://github.com/masknull/dsh-qoder-connect) (MIT).

Upstream's own provenance:

- Derived from [masknull/dsh-workbuddy-connect](https://github.com/masknull/dsh-workbuddy-connect) (MIT) — the connect-plugin skeleton this project was refactored from.
- Qoder transport layer ported from [mo-n/dsh-provider-qoder](https://github.com/mo-n/dsh-provider-qoder) (MIT).

Released under the [MIT](./LICENSE) license; see [NOTICE](./NOTICE) for the upstream attributions. This is a community adapter — not affiliated with, authorized by, or endorsed by Qoder or DeepSeek, and not an official implementation.

## Disclaimer

- Qoder's endpoints come from the upstream repositories: upstream may change, rate-limit or block them at any time, breaking part or all of this plugin with no compatibility window to promise.
- For personal learning and research only; this tool drives **your own** Qoder account. Do not use it commercially or beyond reasonable personal use. You are responsible for complying with Qoder's terms of service and for any consequence — account restriction, quota loss, service interruption — of using this project.
- The authors are not liable for any direct or indirect loss arising from use or misuse of this project. The names Qoder, DeepSeek and related marks belong to their respective owners and appear here only to describe compatibility.
