# 项目进度

> 每个阶段结束时更新。上下文被压缩后，以本文件 + 各阶段文档为准恢复工作。

## 阶段总览

| # | 阶段 | 产出文档 | 状态 |
|---|---|---|---|
| 1 | 产品设计 | [PRD.md](PRD.md) | ✅ v1.1（阶段二补充取消规则与声音选择） |
| 2 | UI 设计 | DESIGN.md、设计稿 | 🟡 v0.4 + 16 张设计稿，Codex 审查 7 条已全部处理，待 PM 确认通过 |
| 3 | 编码 | PLAN.md、源码 | 🟡 M0–M8 完成，M9 双端联调：导入路径双端走通，录音路径待麦克风授权补测 |
| 4 | 测试评测 | TEST_REPORT.md | ⬜ 未开始 |
| 5 | 优化 | OPTIMIZATION.md | ⬜ 未开始 |
| 6 | 交付材料 | README.md、演示视频 | ⬜ 未开始 |

## 角色

| 角色 | 由谁担任 | 职责 |
|---|---|---|
| 主力开发 | Claude Code | 各阶段产出 |
| 独立审查 | Codex（阶段一 CLI；阶段二起 PM 用桌面端执行） | 每阶段产出的独立审查 |
| 产品经理 / 验收人 | 用户 | 取舍、确认、分歧裁决，阶段验收 |

协作记录见 [COLLABORATION.md](COLLABORATION.md)。

## 环境（2026-10-26 盘点）

| 项 | 版本 / 状态 |
|---|---|
| Node / npm | 22.23.4 / 10.9.9 |
| Expo SDK | 58（npm latest `expo@58.0.19`） |
| Xcode | 26.6；模拟器 iPhone 16（iOS 26.3）已启动 |
| Android | SDK 已装；AVD：Pixel_4、Pixel_9、Pixel_9_Pro；JDK 17 |
| Maestro | `~/.maestro/bin/maestro`（不在 PATH 中，需使用完整路径） |
| Codex CLI | 0.164.0，已登录 |
| Git 身份 | 仓库级：`pan609 <53222181+pan609@users.noreply.github.com>`；远程 https://github.com/pan609/fish-redub（公开） |

## 关键事实（防遗忘）

- API Key 在 `.env.local`（已 ignore）；题目原文含 Key 的版本在 `.assignment-original.md`（已 ignore），入库版本为 `docs/ASSIGNMENT.md`（已去除 Key）。
- 接口实测结论见 PRD 附录 A。重点：空文本 TTS 返回 200 静音；静音 ASR 返回 200 空文本；声音样例 URL 1 小时过期，需随包打入。
- 测试额度约 98 credits（2026-10-26）。

## 日志

| 日期 | 事件 |
|---|---|
| 2026-10-26 | 阅读题目；盘点环境；实测 Fish API；选定 4 个预置声音；git init；PRD v0.1 草案 |
| 2026-10-26 | Codex 审查 PRD（12 条，采纳 11 条、部分采纳 1 条）；PRD v0.2 |
| 2026-10-26 | PM 裁决 D1–D7 全选 A；PRD v1.0 定稿；进入阶段二 UI 设计（参考 Fish Audio App 风格） |
| 2026-10-26 | 调研 Fish Audio App（App Store 截图取色）；DESIGN v0.1 → v0.2；Pencil 设计稿 15 张（`design/exports/`）；审查说明 `docs/reviews/phase2-review-brief.md` |
| 2026-10-26 | PM 反馈：去掉粗糙/emoji 图标、开发融合 iOS 26 液态玻璃 → DESIGN v0.3（§6 图标规范、§7 液态玻璃 7 处落地），设计稿重新导出 |
| 2026-10-26 | 处理阶段二 Codex 审查 7 条（全部采纳）：对比度令牌重算、取消不自动重发、声音选择即生效、适配约定、新增 16 号图稿；DESIGN v0.4、PRD v1.1 |
| 2026-10-26 | 阶段二通过；阶段三：SDK 58 脚手架、依赖安装、M0 双端原生能力验证（结果见 PLAN §5）、PLAN v0.1、声音资源与测试音频入库；PM 补充决策方向"健壮优先、不吹毛求疵" |
| 2026-10-26 | 处理 PLAN 审查 6 条（全部采纳）：存储改为每条记录独立 meta.json、任务代次失效、保存重试分离、分层故障注入、原生 60 秒上限；PLAN v0.2、PRD v1.2；PM 确认 GitHub 仓库公开，需保证密钥与环境隐私 |
| 2026-10-26 | 编码 M1–M8 完成并推送；77 条单测；双端联调修复 7 个问题（PLAN §5.1）；录音路径受本机麦克风授权限制待补测 |
| 2026-10-26 | PM 更正 GitHub 账号为 pan609：全部历史提交作者改为 pan609（noreply 邮箱），仓库迁移到 pan609/fish-redub |
| 2026-10-26 | 旧仓库 pany-05/fish-redub 已改为私有（PM 决定）；本地保留备份分支 backup/pre-pan609 |
| 2026-10-26 | PM 授权本机麦克风后补测录音路径：iOS（正常、过短、后台、60 秒）与 Android（录音、预览、播放、静音→未识别）全部通过；Android 崩溃确认为麦克风授权问题；修复准备阶段重复启动与重录残留波形 |
