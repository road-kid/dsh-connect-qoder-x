# DSH Qoder Connect X

[English](./README.en.md) | **简体中文**

把 **Qoder 订阅**的模型以个人访问令牌（PAT）接入 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的社区插件。

一个插件同时服务两条 Qoder 产品线，各自一套凭证、一个 provider、一份模型目录，互不混用：

| 变体 | provider id | PAT 生成站点 |
|---|---|---|
| 国内版 | `qoder` | qoder.com.cn |
| 国际版 | `qoder-global` | qoder.com |

只需要哪一版就只配哪一版：未保存 PAT 的变体不显示模型分组，另一版完全不受影响。流式输出、推理内容、工具调用走插件内置的 Qoder 传输层；对话循环、压缩与权限始终由 DSH 本体掌控。

---

## 这个仓库是什么

本仓库是 [masknull/dsh-qoder-connect](https://github.com/masknull/dsh-qoder-connect)（`dsh-qoder-connect`）的 **fork**，重命名为 `dsh-connect-qoder-x`。

**为什么 fork**：上游 0.2.0 的插件设置界面注册在 DSH 0.1.7 已不再使用的槽位上，其结果是在「插件」页里没有任何入口——设置界面挂在一个孤立的「设置 → 插件设置」导航区里。本 fork 把它移植到 0.1.7 正式的插件配置槽位，并**改包名、改插件名、改行 id**，以便与上游安装**在同一 profile 内共存**、互不覆盖。机制细节见[移植说明](#移植说明017-的插件配置槽位)。

**与上游的关系**：`upstream` remote 指向 `masknull/dsh-qoder-connect`，本 fork 的改动集中在 `feat/port-to-dsh-0.1.7-plugin-config` 分支。

```sh
git remote -v
# origin    https://github.com/road-kid/dsh-connect-qoder-x.git
# upstream  https://github.com/masknull/dsh-qoder-connect.git

# 同步上游改动
git fetch upstream
git merge upstream/main
```

**命名对照**（与上游共存的关键）：

| 项 | 上游 `dsh-qoder-connect` | 本 fork `dsh-connect-qoder-x` |
|---|---|---|
| 包名 | `dsh-qoder-connect` | `dsh-connect-qoder-x` |
| profile 行 id | `llm-qoder` | `llm-qoder-x` |
| 数据目录 | `<profile>/.dsh-qoder-connect/` | `<profile>/.dsh-connect-qoder-x/` |
| HTTP 路由前缀 | `/plugins/dsh-qoder-connect/*` | `/plugins/dsh-connect-qoder-x/*` |
| CLI 命令 | `dsh-qoder-connect` | `dsh-connect-qoder-x` |

> **两套数据目录互不相通**：本 fork **不会**读取上游的 PAT、模型目录或签到记录。
> 从上游迁移过来时需要重新粘贴 PAT（或把上游的 `.qoder-auth.json`
> 手工复制为 `.dsh-connect-qoder-x/.qoder-auth.json`）。

---

## 功能

- **PAT 即存即用**：在设置卡片上粘贴 PAT 点「保存」，插件先对该变体的区域实时校验，通过才落盘，模型分组立即出现，无需重启 DSH。已登录后可「更换 PAT」（新令牌校验通过才覆盖，粘贴打错不会把可用凭据弄丢）与「清除 PAT」。
- **双变体独立配置**：`qoder`（china）与 `qoder-global`（global）各有自己的凭证文件、路由与已保存目录——qoder.com 生成的令牌对中国区无效，反之亦然，两套永不互串。
- **模型目录三级降级（live → saved → fallback）**：卡片明示当前列表来自哪里——「模型列表更新于 …」（实时拉取）、「当前显示已保存的模型列表，更新于 …」（本账号上次成功目录，重启或断网后顶上来）、「当前显示内置模型列表（尚未从 Qoder 更新）」（编译进插件的兜底名单）；最近一次拉取失败时附带原因，并可在卡片上手动「刷新模型列表」。
- **上下文窗口一键切换**：变体卡片的「上下文窗口」页列出每个模型的容量（默认值与上游声明的最大值），并提供「使用上游声明的最大上下文窗口」开关（默认勾选）：勾选按最大窗口（如 Qwen3.8-Max 的 1M）发请求，不勾选按默认窗口（200K），两版开关状态独立保存、互不影响。
- **模型自由开关与批量管理**：变体卡片提供「模型开关」页，可自由开启或关闭指定模型；关闭的模型将自动从 DSH 的模型选择器中隐藏；顶部提供按名称/ID 的即时搜索框，并支持全选与一键「批量开启」/「批量关闭」。
- **每日自动签到与日志明细**：支持每天自动签到领取 100 Credits 算力额度，**签到时刻可在卡片上自定义**（默认 10:00，即上游刷新时间，按 UTC+8），配备双端开关与开机防漏补签机制；卡片常驻「签到日志」面板，提供执行流水记录与「立即签到」、「刷新」、「清空日志」快捷操作。
- **侧栏额度展示 + 额度明细**：可分别为两版开启侧栏底部的额度小卡（默认关，开启前需为该变体保存 PAT），共享一个刷新间隔（默认 5 分钟，最小 1 分钟）。点侧栏小卡在中间面板打开「Qoder 额度」明细：按资源包逐行给出「剩余 / 总量 + 进度条｜到期时间」，合计占比与本轮重置时间一并展示；再点同一张卡关闭，点另一张切换到对应版本。
- **倍率显示 `x<priceFactor>`**：模型名后直接拼上游报价的价格倍率（如 `某模型 · x0.79`，免费为 `x0.0`），来自目录接口的 `price_factor` 字段，仅作展示、不影响请求；上游未报倍率的模型不显示后缀，不会凭空补一个数。整数倍率统一补一位小数（`x1.0`），非整数倍率按上游原值显示（`x0.79`、`x1.6`）。

---

## 在哪里找到设置界面

DSH 0.1.7 把插件配置统一收进了**「插件」页**。本插件的设置界面有**两个入口**，内容是同一张卡片：

1. **行配置页（主入口）** —— 侧边栏「插件」→ 点卡片 **DSH Qoder Connect X** 进入包详情页 → 在行列表里找到 `llm-qoder-x`，点它右侧的**「配置」**
2. **包配置区（次入口）** —— 侧边栏「插件」→ 点卡片 **DSH Qoder Connect X** → 设置正文**直接内联**在包描述下方

卡片本身不再自带折叠外壳（标题、图标、面包屑由「插件」页绘制），内部的「国内版 / 国际版」切换与状态、上下文窗口、模型开关、额度明细、签到日志等页签保持不变。

> **从旧版本升级过来**：0.1.7 之前，本插件的设置挂在「设置 → 插件设置」。那个入口现已**移除**——它是旧槽位的产物，不是 DSH 的正式导航项。

---

## 安装

前置条件：

- DSH 核心 **`>=0.1.7-rc.1 <0.2.0`**；
- Node.js `^22.19.0 || >=24.0.0`（`package.json` engines）；
- 你自己的 Qoder 账号，以及至少一枚个人访问令牌。

> **版本支持范围（与上游不同，请注意）**
>
> 上游 `dsh-qoder-connect` 是**双线并存**的：0.1.5/0.1.6 走 `settings.plugin.item`，
> 0.1.7 走共享的 `plugin-settings.item`。本 fork 按 0.1.7 的正式槽位重写，
> **只适配 0.1.7 及以后**——这是移植的既定取舍，不是缺陷。
>
> 在 **0.1.5 / 0.1.6** 上：**宿主功能（模型、PAT、目录、签到）照常可用**，
> 但**设置卡片不会出现**（那两个版本没有 `plugins.row.config` 槽）。
> 需要旧线支持请使用上游插件。
>
> 版本下限通过 `peerDependencies` 的 `@deepseek-ai/dsh-*` 区间声明——
> 这是 DSH 安装时**实际校验**的字段（`app-boot` 的兼容性预检只读 peer 依赖，
> 不读 `engines.dsh`）。

```sh
# 从 GitHub 安装本 fork
dsh plugin --profile web add github:road-kid/dsh-connect-qoder-x
```

按你使用的 profile 换 `--profile` 的值（`web` / `desktop` / `tui`）。装到哪个 profile，数据就落在哪个 profile 目录里，各自独立。

> **本 fork 与上游可以同时安装**：包名、行 id、路由、数据目录全部不同，两份配置互不干扰。确认不再需要上游版本后再卸载它：`dsh plugin --profile web remove dsh-qoder-connect`。

---

## 配置与使用

### 生成 PAT

- **Qoder（国内版）**：登录 qoder.com.cn → 账号设置 → 个人访问令牌，生成后复制。[直达获取](https://qoder.cn/account/integrations)
- **Qoder Global（国际版）**：登录 qoder.com → 账号设置 → 个人访问令牌，生成后复制。[直达获取](https://qoder.com/account/integrations)

### 在卡片上保存

按上一节的路径打开设置界面，把 PAT 粘贴进密码输入框，点「保存」（期间显示「校验并保存中…」）。保存动作会先经 Qoder 校验令牌对该变体的区域有效，失败则不落盘并提示「PAT 无效或已过期 — 请到账号设置重新生成后再试。」两版各填各的卡片即可两组并存。

### 环境变量兜底

不方便走卡片的场景可用环境变量：**未保存过凭证文件**时插件读取 env 兜底——

| 变体 | 环境变量 |
|---|---|
| `qoder`（china） | `QODER_CN_PERSONAL_ACCESS_TOKEN` |
| `qoder-global` | `QODER_PERSONAL_ACCESS_TOKEN` |

优先级为 **文件 > env**：只要该变体保存过有效的凭证文件，环境变量就不再生效。

---

## 数据与隐私

插件的全部自有文件收在数据目录一处：`<profile>/.dsh-connect-qoder-x/`（凭据在根，可重建的缓存在 `state/` 子目录）：

```text
<profile>/.dsh-connect-qoder-x/
├── .qoder-auth.json              # 中国版 PAT
├── .qoder-global-auth.json       # 国际版 PAT
├── settings.json                 # 侧栏展示 / 签到时刻等自有配置
├── checkin-status.json           # 签到状态与历史日志
└── state/
    ├── .qoder-catalog.json       # 中国版按账号保存的模型目录
    ├── .qoder-global-catalog.json
    ├── .qoder-probe.json         # 中国版推理档位探测记录
    ├── .qoder-global-probe.json
    ├── .qoder-host-heartbeat.json
    └── .qoder-machine-id
```

环境变量 `DSH_QODER_DATA_DIR` 可显式覆盖数据目录。

---

## 移植说明：0.1.7 的插件配置槽位

上游 0.2.0 把设置界面注册在 `settings.section` 下自建的 `plugin-settings.item` 子槽里（三个 connect 插件当年的私下约定）。0.1.7 的实际情况是：

- `settings.section` 的 children 只有 `settings.general.item`、`settings.plugins.tab`、`settings.models.provider-card`、`settings.models.footer` 四项，**没有** `plugin-settings.item`；
- 「内置插件」页已改建为 **tab 容器**（只认 `settings.plugins.tab`），旧入口 `settings.plugin.item` 已从 `SlotMap` **删除**；
- 插件配置改由 `ui-plugin-manager` 的 **keyed 槽**承载。

于是上游的卡片成了一个**没有入口的孤岛**。本 fork 改为注册：

| 槽 | key | 作用 |
|---|---|---|
| `plugins.row.config` | `dsh-connect-qoder-x#llm-qoder-x` | 行列表出现「配置」按钮，点开是本卡片 |
| `plugins.bundle.config` | `dsh-connect-qoder-x` | 包详情页内联渲染同一张卡片 |

行 key 是 `` `${包名}#${行id}` ``，行 id 取自本插件 patch 声明的 `id`。**这就是本 fork 必须同时改包名与行 id 的原因**：两者共同构成这个 key。

卡片组件据此适配宿主的 `view` 契约：

- `view === 'summary'` → 只返回一行简介（卡片列表的副标题）
- `view === 'page'` → 返回设置正文，**不自绘标题与折叠外壳**（宿主已经画了）

---

## 开发

```sh
pnpm install
pnpm run build      # tsdown 产出 lib/（宿主 bundle + client bundle）
pnpm test           # vitest run
pnpm run test:qoder # node --test（Qoder 传输层用例）
pnpm run typecheck  # tsc：宿主 + client 两份 tsconfig
pnpm run check      # typecheck + test + test:qoder + build
```

> **已知问题（继承自上游，与本 fork 的移植无关）**：`tests/reasoning-merge.spec.ts` 与 `tests/settings-integration.spec.ts` 的部分用例在上游快照 `631be5c` 上同样失败（前者在 `boot()` 后挂起直至超时）。已在纯净的上游快照上独立复现，非本 fork 引入。

---

## 出处与许可

本仓库是 [masknull/dsh-qoder-connect](https://github.com/masknull/dsh-qoder-connect)（MIT）的 fork。

上游自身的出处：

- 骨架与 connect 机制改造自 [masknull/dsh-workbuddy-connect](https://github.com/masknull/dsh-workbuddy-connect)（MIT）；
- Qoder 传输层移植自 [mo-n/dsh-provider-qoder](https://github.com/mo-n/dsh-provider-qoder)（MIT）。

本项目按 [MIT](./LICENSE) 许可发布，双上游出处详见 [NOTICE](./NOTICE)。本仓库与 Qoder、DeepSeek 官方均无关联，是社区适配器——非官方实现。

## 免责声明

- Qoder 的接口来自上游仓库：上游随时可能改动、限流或封禁调用方，导致本插件部分或全部功能失效；届时可能只有等社区跟进，不保证兼容窗口。
- 本工具仅供个人学习研究，用于驱动**使用者自己的** Qoder 账号；请勿用于商业转售或任何超出个人合理使用的场景。使用即表示你自行承担账号被限制、额度损失、服务中断等一切后果，并遵守 Qoder 的服务条款。
- 作者不对因使用或滥用本插件产生的任何直接或间接损失负责。文中出现的 Qoder、DeepSeek 等名称与商标归各自权利人所有，仅作兼容性描述之用。
