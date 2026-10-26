# PLAN：编码计划

| 项 | 内容 |
|---|---|
| 版本 | v0.2（合入 Codex PLAN 审查 6 条：存储改为每条记录独立元数据、任务代次失效、保存重试、分层故障注入、原生 60 秒上限） |
| 日期 | 2026-10-26 |
| 依据 | [PRD.md](PRD.md) v1.1、[DESIGN.md](DESIGN.md) v0.4 |
| 决策方向 | 以项目足够健壮为目标：核心流程可靠、异常可恢复、数据不丢不错；不为形式完美增加复杂度 |

---

## 1. 技术选型

| 领域 | 选择 | 版本 | 理由 |
|---|---|---|---|
| 框架 | Expo（create-expo-app `default@sdk-58` 模板）+ React Native + TypeScript（strict） | expo 58.0.19 / RN 0.88 / TS 6.0 | 题目要求；SDK 58 为当前稳定版 |
| 路由 | expo-router（文件路由） | 58.0.26 | 模板自带；支持 NativeTabs、formSheet |
| Tab | `expo-router/native-tabs` | — | iOS 26 液态玻璃 Tab Bar；Android Material 3 底部导航 |
| 玻璃 | expo-glass-effect（`GlassView` / `GlassContainer` / `isLiquidGlassAvailable`） | 58.0.5 | 官方模块，自带降级判断 |
| 图标 | expo-symbols（`SymbolView`，iOS SF Symbols / Android Material Symbols） | 58.0.4 | DESIGN §6 图标规范 |
| 录音 / 播放 | expo-audio（`useAudioRecorder`、`useAudioRecorderState`、`createAudioPlayer`、`setAudioModeAsync`） | 58.0.10 | 官方模块，录音与播放一套 API |
| 文件选择 | expo-document-picker | 58.0.4 | 系统文件选择器 |
| 文件读写 | expo-file-system（新版 `File` / `Directory` / `Paths`；Android 导出用 `Directory.pickDirectoryAsync`） | 58.0.11 | 沙盒读写、SAF 目录选择 |
| 分享 | expo-sharing | 58.0.20 | 系统分享面板（iOS"存储到文件"） |
| 网络状态 | expo-network（`useNetworkState`） | 58.0.4 | 离线提示 |
| 唯一 ID | expo-crypto（`randomUUID`） | 58.0.7 | 记录 ID |
| 状态管理 | zustand | 5.0 | 轻量，状态机逻辑写成纯函数便于测试 |
| 单元测试 | jest-expo + jest + @testing-library/react-native | 58 / 30 / 14 | 官方测试预设 |
| 端到端 | Maestro（`~/.maestro/bin/maestro`） | 本机已装 | 阶段四使用 |

不引入：表单库、UI 组件库、网络库（axios）、数据库。历史数据量小（单用户、短音频），用一个 JSON 索引文件即可，减少依赖和原生构建风险。

## 2. 目录结构

```
src/
├── app/                              路由层（只做页面组装，不放业务逻辑）
│   ├── _layout.tsx                   根 Stack：Tabs + 两个 formSheet 路由 + 全局初始化
│   ├── recorder.tsx                  录音弹层（formSheet）
│   ├── voice-picker.tsx              声音选择弹层（formSheet）
│   └── (tabs)/
│       ├── _layout.tsx               NativeTabs：配音 / 历史
│       ├── (redub)/_layout.tsx       Stack（透明大标题）
│       ├── (redub)/index.tsx         配音主页面（四张步骤卡片）
│       ├── history/_layout.tsx       Stack（透明大标题）
│       ├── history/index.tsx         历史列表
│       └── history/[id].tsx          历史详情
├── features/
│   ├── redub/                        主流程
│   │   ├── machine.ts                状态机纯函数（迁移规则、快照、过期判定）
│   │   ├── store.ts                  zustand store：调用服务、维护 requestId / AbortController
│   │   └── components/               StepAudio / StepText / StepVoice / StepDub / ResultCard
│   ├── recorder/                     useRecorderSession（权限、计时、60 秒、后台收尾）
│   ├── importer/                     importAudio（选择 → 复制 → 校验）
│   └── history/                      列表、详情组件与 store
├── services/
│   ├── fish/                         client（超时、取消）、asr、tts、errors（错误归一化）
│   ├── audio/                        coordinator（全局单音源）、probe（读时长）、sniff（文件头校验）
│   ├── storage/                      paths、historyRepo（每条记录独立 meta.json、幂等提交、启动恢复、串行队列）
│   └── export/                       share、exportToDevice（iOS 分享面板 / Android SAF）
├── ui/
│   ├── tokens.ts                     DESIGN §3 令牌（浅色 / 深色）
│   ├── theme.ts                      useTheme
│   └── components/                   Icon、Glass、Button、StepCard、AudioPlayer、Waveform、InlineAlert、VoiceAvatar …
├── config/
│   ├── env.ts                        读取 EXPO_PUBLIC_*，缺失时给出明确错误页
│   └── voices.ts                     4 个预置声音（ID、名称、语言、简介、头像、样例）
├── copy/strings.ts                   界面文案与错误文案（PRD §7.1 为准）
└── utils/                            format（时长、大小、日期）、result 类型等
assets/voices/                        头像 webp + 样例 mp3（随包）
```

## 3. 关键设计

### 3.1 主流程状态（PRD §5）

状态拆成相互独立的四段，用联合类型表达，避免"布尔值组合出非法状态"：

```ts
type SourceState =
  | { kind: 'empty' }
  | { kind: 'importing' }
  | { kind: 'ready'; audio: SourceAudio }            // SourceAudio：id、名称、来源、uri、时长、大小
  | { kind: 'invalid'; error: AppError; previous?: SourceAudio };

type TextState =
  | { kind: 'locked' }
  | { kind: 'transcribing'; requestId: number }
  | { kind: 'cancelled' }                            // 待转写：手动"开始转写"，不自动重发
  | { kind: 'failed'; error: AppError }
  | { kind: 'empty' }                                // 未识别到有效语音
  | { kind: 'editing'; transcript: string; draft: string; language?: string }
  | { kind: 'confirmed'; transcript: string; finalText: string; language?: string };

type DubState =
  | { kind: 'idle' }
  | { kind: 'generating'; requestId: number; snapshot: DubSnapshot; previous?: DubResult }
  | { kind: 'failed'; error: AppError; snapshot: DubSnapshot; previous?: DubResult }        // 请求失败 → "重试"会重新调用 TTS
  | { kind: 'saving'; pending: PendingDub; previous?: DubResult }                          // 音频已到手，正在落盘
  | { kind: 'saveFailed'; error: AppError; pending: PendingDub; previous?: DubResult }   // 落盘失败 → "重试保存"，不重发 TTS
  | { kind: 'success'; result: DubResult };          // result 内含生成它的 snapshot

// 待保存上下文：保存失败后重试只用它，不重新请求
type PendingDub = { recordId: string; snapshot: DubSnapshot; audioUri: string; durationMs: number; createdAt: string };

type DubSnapshot = { sourceId: string; transcript: string; finalText: string; voiceId: string };
```

- **过期不存储，实时计算**：`isExpired = result.snapshot` 与当前 `{sourceId, finalText, voiceId}` 不一致。避免状态不同步。
- **任务代次（请求守卫）**：store 为转写、生成各维护一个递增的 `requestId` 和当前 `AbortController`。**取消、超时、换源都会立即把 `requestId` 加一**，使旧任务失效；旧任务在每个 `await` 之后（收到响应、读完响应体、校验完成、文件写完）都检查 `isCurrent(requestId)`，失效即停止并清理自己写出的临时文件，不再改动界面或写入历史。
- **取消边界**：请求阶段和"已收到音频、尚未提交元数据"之前都可以取消；一旦开始写入记录元数据（§3.5 第 4 步，毫秒级），该次保存不可取消，界面在 `saving` 期间隐藏取消按钮。
- **两种重试分开**：`failed`（请求失败）→"重试"重新调用 TTS；`saveFailed`（落盘失败）→"重试保存"只用 `PendingDub` 再走一次持久化，`recordId` 不变，不会重发 TTS，也不会产生重复记录。生成得到的音频在收到后立即写入 `Paths.document/work/<recordId>.mp3`；如果连这一步都失败，就把字节暂存在内存里供重试。
- **迁移规则写成纯函数**（`machine.ts`），由单元测试覆盖：换源、取消、过期、重试沿用快照、空白文本拦截等。

### 3.2 Fish API 客户端

- 统一 `request()`：`AbortController` 同时承担超时（转写 30 秒、生成 60 秒）和用户取消；能区分 `timeout` 与 `cancelled`。**超时计时覆盖到响应体读取完毕**（`arrayBuffer()` / `json()` 结束才清除定时器），响应体读到一半断流归为 `incomplete_audio`（TTS）或 `server`（ASR）。
- **错误归一化** `AppError { code, message, retryable, retryAfterSec? }`，`code` ∈ `offline | timeout | auth | quota | rate_limit | bad_audio | bad_request | server | incomplete_audio | save_failed | cancelled | unknown`，文案统一来自 `copy/strings.ts`。
- ASR：`multipart/form-data`（`audio` 文件 + `ignore_timestamps=true`），返回 `text`、`duration`、`language_code`。`text.trim()` 为空 → `empty`。
- TTS：JSON `{ text, reference_id, format: 'mp3' }` → `arrayBuffer()` → **完整性校验**（有 Content-Length 时比对字节数；字节数 > 0；Content-Type 为 audio；MP3 文件头为 ID3 或帧同步）→ 写入工作目录 → 用播放器加载确认时长 > 0。
- 客户端前置拦截：`finalText.trim()` 为空或超过 1000 字不发请求（PRD G5）。
- 不做自动重试（PRD §7.2）。429 读 `Retry-After`。

### 3.3 音频

- **AudioCoordinator（单例）**：注册所有播放器（原音、样例、配音、历史）。`play(key)` 先暂停其他；`stopAll()` 供录音前、页面离开、App 进入后台调用。
- **音频会话**：录音前 `setAudioModeAsync({ allowsRecording: true })`；录音结束立即恢复 `allowsRecording: false`，保证 iOS 外放正常（PRD A2）。
- **录音**：M4A / AAC / 单声道 / 44.1kHz / 64kbps，开启 metering 驱动波形；`useAudioRecorderState` 驱动计时。**60 秒上限由原生 `recorder.record({ forDuration: 60 })` 保证**（JS 卡顿也不会超时长），JS 计时只负责显示和在原生停止后触发收尾；收尾时再校验时长 ≤ 60.5 秒。
- **统一收尾 `finalize(reason)`**：停止、60 秒、后台、系统中断共用，ref 防重入 → 检查文件存在且大小 > 0 → 读取时长（5 秒超时）→ ≥1 秒进入预览，否则给出对应原因。
- **后台**：`AppState` 变为 `background` 时调用 `finalize('background')`，返回前台后展示结果提示。
- **确认使用后的音源**：录音或导入的文件在用户确认使用（或导入校验通过）后移入 `Paths.document/work/`，不放在缓存目录，避免被系统清理（PRD R10）。
- **时长探测 `probeDuration(uri)`**：`createAudioPlayer` 加载，等待 `isLoaded` 且 `duration > 0`，5 秒超时，用完释放。

### 3.4 导入

`DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true })` → 取消则静默返回 → 校验扩展名 → 复制到工作目录 → 实测大小（0 / >10MB）→ 读前 16 字节判断容器（MP3 ID3/帧同步、WAV RIFF/WAVE、M4A ftyp）→ 探测时长（1–60 秒）。每一步失败都对应 PRD I3 的文案。

### 3.5 存储与 History

> v0.2 变更：v0.1 的"单个索引文件 + 临时文件替换"存在两个问题（Codex PLAN 审查 #1、#2）：索引读取失败后若按空索引清理，会误删全部历史音频；SDK 58 的 iOS `move(overwrite)` 是"先删目标再移动"，不是原子替换，并发保存和删除还会争用同一个索引。改为**每条记录自带元数据文件**，不再有共享索引。

| 内容 | 位置 |
|---|---|
| 工作文件（未确认的录音、导入副本） | `Paths.cache/work/` |
| 已确认音源、待保存配音 | `Paths.document/work/`（App 每次启动时清空，因为会话状态不跨重启保留） |
| 成功记录 | `Paths.document/records/<id>/`：`source.<ext>`、`dub.mp3`、`meta.json` |

**记录 = 一个目录；`meta.json` 存在才算一条完整记录。** 记录创建后不再修改（只读），删除就是删掉整个目录，所以存储层从不需要覆盖写。

**保存协议**（PRD §6.1，`historyRepo.commit(pending)`，以 `recordId` 为幂等键）：

1. 若 `records/<id>/meta.json` 已存在 → 视为已提交，直接返回（重试保存不会重复落库）。
2. 创建 `records/<id>/`，复制原音为 `source.<ext>`、复制配音为 `dub.mp3`，逐个等待写入完成并校验大小 > 0。
3. 写 `meta.json.tmp` 并读回校验 JSON。
4. 把 `meta.json.tmp` 重命名为 `meta.json`。目标不存在，所以是同目录内的一次原子重命名，**到这一步才算提交成功**。
5. 第 2–4 步任何一步失败 → 删除 `records/<id>/`（这时还没有 `meta.json`，删除不会影响任何已提交记录）→ 返回 `save_failed`，界面进入 `saveFailed`。

**读取与恢复**（启动时，`historyRepo.load()`）：

- 遍历 `records/*/`：`meta.json` 能解析 → 正常记录；文件缺失 → 标记"文件不可用"（H5）。
- `meta.json` 存在但解析失败 → 列为"记录损坏"，**保留目录，不删除**，详情页仍可尝试播放其中的音频文件。
- 没有 `meta.json` 但有 `meta.json.tmp` 且能解析 → 视为第 4 步之前崩溃，补做重命名恢复。
- 两者都没有 → 未完成的保存残留。**只有在 `load()` 完整结束、确认没有任何异常之后**，才删除这类目录；`load()` 中途出错时跳过所有清理。
- 清理在启动时、任何保存开始之前执行（App 初始化完成前生成按钮不可用），所以不会误删正在写入的目录。

**串行化**：所有 `commit` / `delete` / 清理操作通过 repo 内部的一个串行队列（Promise 链）依次执行，避免同一目录的并发操作。

**相对路径**：`meta.json` 里只存文件名（`source.m4a`、`dub.mp3`），运行时拼接 `Paths.document/records/<id>/`。

### 3.6 导出与分享

- **分享**（双端）：把配音复制为友好文件名 `redub_<声音名>_<yyyyMMdd_HHmm>.mp3` 到缓存目录后调用 `Sharing.shareAsync`。关闭面板不提示成功或失败。
- **导出**：
  - iOS：同分享面板，用户选"存储到文件"。
  - Android：`Directory.pickDirectoryAsync()`（SAF）→ 在所选目录创建文件并写入 → 成功提示"已导出到所选目录"；用户取消静默；重名加序号；写入失败可重试。

### 3.7 界面层

- 令牌、组件按 DESIGN 实现；`Icon` 统一封装 `SymbolView`（DESIGN §6.2 映射表）。
- `Glass` 组件：`isLiquidGlassAvailable()` 为真时渲染 `GlassView`，否则渲染实色降级样式。
- 每个可交互元素按 DESIGN §11 设置 `testID`，供 Maestro 使用。

### 3.8 配置与密钥

- `.env.local` 提供 `EXPO_PUBLIC_FISH_API_KEY`、`EXPO_PUBLIC_FISH_API_BASE`；`config/env.ts` 启动时校验，缺失时页面直接提示"未配置 API Key"，不在请求时才失败。
- 已知限制：`EXPO_PUBLIC_*` 会打包进客户端（README 说明）。

### 3.9 测试辅助：分层故障注入（仅开发构建）

故障要走真实的校验和回滚路径才有意义（Codex PLAN 审查 #5），所以在两层注入，而不是在客户端直接伪造错误：

| 层 | 注入点 | 可模拟的故障 |
|---|---|---|
| 网络层 | `client.ts` 依赖可替换的 `fetch`；故障版 `fetch` 包装真实响应 | 断网（抛 TypeError）、超时 / 响应体慢读、401 / 402 / 429（带 Retry-After）/ 500、TTS 响应体截断（声明的 Content-Length 大于实际字节）、非音频 Content-Type、空响应体 |
| 存储层 | `historyRepo` 依赖可替换的文件系统适配器 | 复制原音失败、写配音失败、写 `meta.json.tmp` 失败、重命名失败 |

- **单元测试**（M2）：用上述注入断言——截断会被识别为 `incomplete_audio`；任一步存储失败都不留下 `meta.json`、不删除其他记录；重试保存不重发请求、不产生重复记录；`meta.json` 损坏时不清理任何目录。
- **手动 / Maestro**（阶段四）：开发构建中长按"配音"标题打开调试面板选择故障。生产构建不包含该入口。

## 4. 任务拆分（里程碑）

每个里程碑结束时：`tsc --noEmit` + `expo lint` + 单元测试通过，提交一次 git。

| # | 里程碑 | 内容 | 覆盖验收项 |
|---|---|---|---|
| M0 | 脚手架与原生能力验证 | SDK 58 模板、依赖安装、NativeTabs / formSheet / GlassView / SymbolView 双端验证（§5） | 9 |
| M1 | 基础层 | 令牌、主题、Icon、Glass、Button、StepCard、InlineAlert、env 校验、声音资源随包 | — |
| M2 | 服务层 + 单测 | Fish 客户端（超时覆盖响应体、错误归一化）、TTS 完整性校验、文件头校验、historyRepo（每条记录独立元数据、幂等提交、恢复、串行队列）、分层故障注入及其单测、导出；**双端真实接口各跑一次 ASR / TTS** | 7、8 |
| M3 | 主流程状态机 + 单测 | machine.ts、store.ts（任务代次失效、取消边界、快照、过期、保存失败与重试保存分离） | 3、4、8 |
| M4 | 音频与录音 | AudioCoordinator、AudioPlayer / Waveform、录音弹层（权限、计时、原生 60 秒上限、预览、后台）、确认音源移入 document；**双端验证 60 秒自动结束与录音后外放音量** | 1、5 |
| M5 | 导入 | 选择、复制、五项校验、取消静默 | 2 |
| M6 | 转写与编辑 | 转写中 / 已取消 / 为空 / 失败 / 编辑 / 确认 | 3 |
| M7 | 声音、生成、结果、导出 | 声音弹层（即选即生效、试听）、生成中 / 失败 / 成功 / 过期、分享与导出 | 4、6 |
| M8 | History | 列表、详情（对照、播放、分享、导出、删除）、空状态、文件不可用 | 7 |
| M9 | 双端联调 | iOS 与 Android 完整走通中英文流程；小屏与大字体检查（DESIGN §5.9） | 9 |

## 5. M0 原生能力验证结果（2026-10-26）

环境：iOS 模拟器 iPhone 16 / iOS 26.3；Android 模拟器 Pixel 9。开发构建（`expo prebuild` + `expo run:*`）。截图在 `docs/spike/`。

| 能力 | iOS 26 | Android | 结论 / 编码时的处理 |
|---|---|---|---|
| `NativeTabs`（SF Symbol / Material 图标） | ✅ 液态玻璃浮动 Tab Bar | ✅ Material 3 底部导航 | 直接使用 |
| `isLiquidGlassAvailable()` | `true` | `false` | 作为玻璃 / 降级的唯一判断依据 |
| `GlassView`（`isInteractive`、`tintColor`） | ✅ 玻璃效果正常，着色可用 | ⚠️ 渲染为普通透明 View，没有任何背景 | `Glass` 组件必须自带降级背景色（`surfaceMuted` / 主色），不能直接裸用 `GlassView` |
| `SymbolView` | ✅ SF Symbols | ✅ Material Symbols | 直接使用，按 DESIGN §6.2 映射 |
| Stack 透明大标题（`headerLargeTitle` + `headerTransparent`） | ✅ 大标题 + 滚动收起 | ❌ 标题与内容重叠（`contentInsetAdjustmentBehavior` 仅 iOS 有效） | 只在 iOS 开启 `headerTransparent` / `headerLargeTitle`；Android 用实色导航栏 |
| `formSheet`（不设背景色，档位 `[0.6, 1]`） | ✅ 系统绘制浮动玻璃弹层：四周留边、大圆角、透出背后内容；抓手正常 | ⚠️ Material 底部弹层可用，但直角、无抓手、灰色背景 | iOS 不设背景色；Android 设置 `sheetCornerRadius: 28`、`contentStyle` 背景为 `surface`，并自绘抓手 |

验证结论：DESIGN §7 的液态玻璃方案在 iOS 26 上全部可用；Android 降级路径明确，无阻塞项。

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| RN `fetch` 上传本地文件（multipart）与读取二进制响应在两端行为差异 | M2 先用真实接口在双端各跑一次 ASR / TTS；如有问题改用 `expo/fetch` 或 `File.upload` |
| iOS 录音后外放变小 | 录音结束立即恢复播放模式；M4 专项验证 |
| 模拟器麦克风不稳定 | iOS 模拟器使用 Mac 麦克风；Android 模拟器开启主机音频输入；同时准备导入用测试音频 |
| SAF 写入在不同 Android 版本上的差异 | M7 在 Android 模拟器验证；失败时降级为分享面板 |
| API 额度有限（约 98 credits） | 单测全部 mock；联调用短句；E2E 控制次数 |

## 7. 提交规范

- 提交信息使用中文，格式 `<类型>: <说明>`（feat / fix / refactor / test / docs / chore / design）。
- 每次提交前确认 `git diff --cached` 中没有 `sk-fish-`。
- GitHub 远程仓库待 PM 确认公开或私有后创建（账号 `pany-05`）。
