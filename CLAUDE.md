# Fish RN：录音转写与重新配音（RN 笔试）

## 先读这些

- 题目：`docs/ASSIGNMENT.md`
- 当前进度与关键事实：`docs/PROGRESS.md`（每次恢复上下文先读）
- 各阶段文档：`docs/PRD.md`、`docs/DESIGN.md`、`docs/PLAN.md`、`docs/TEST_REPORT.md`、`docs/OPTIMIZATION.md`
- 多 Agent 协同与裁决记录：`docs/COLLABORATION.md`

## 工作约定

- 角色：Claude = 主力开发；Codex = 独立审查（由 PM 用 Codex 桌面端执行，Claude 不调用 codex，只准备 `docs/reviews/phaseN-review-brief.md`）；用户 = PM / 验收人，负责裁决。
- 与用户对话一律使用中文。
- 决策方向：以项目足够健壮为目标，不吹毛求疵；处理审查意见时按影响健壮性与验收的程度取舍。
- 阶段顺序：产品设计 → UI 设计 → 编码 → 测试评测 → 优化 → 交付材料；每阶段经审查和 PM 确认后再进入下一阶段。
- 文档、注释使用中文。
- 密钥只放 `.env.local`，绝不写入源码或文档。仓库已配置 `core.hooksPath=.githooks`，pre-commit 会拦截密钥、令牌、本机绝对路径和 .env 文件（新克隆需执行 `git config core.hooksPath .githooks`）。
- 仓库公开：https://github.com/pany-05/fish-redub ；文档里不写本机绝对路径。
- 推送时临时使用 pany-05 的 gh 令牌（不切换全局 gh 账号、不把令牌写进 .git/config）：
  `git -c credential.helper= -c "credential.helper=!f(){ echo username=pany-05; echo password=$(gh auth token --user pany-05); }; f" push`
- Git 身份：`pany-05 <pany.panpan05@gmail.com>`（仓库级配置）。
- Maestro 路径：`~/.maestro/bin/maestro`。
- Pencil：PM 在 Pen 中打开的工作文件为 `~/.pencil/documents/b7e0384a-ab19-46ea-ae0b-f317e9741917/fishRN.pen`；项目内 `design/fishRN.pen` 是快照，改稿后需重新复制。
