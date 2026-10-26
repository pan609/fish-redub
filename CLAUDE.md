# Fish RN：录音转写与重新配音（RN 笔试）

## 先读这些

- 题目：`docs/ASSIGNMENT.md`
- 当前进度与关键事实：`docs/PROGRESS.md`（每次恢复上下文先读）
- 各阶段文档：`docs/PRD.md`、`docs/DESIGN.md`、`docs/PLAN.md`、`docs/TEST_REPORT.md`、`docs/OPTIMIZATION.md`
- 多 Agent 协同与裁决记录：`docs/COLLABORATION.md`

## 工作约定

- 角色：Claude = 主力开发；Codex = 独立审查（由 PM 用 Codex 桌面端执行，Claude 不调用 codex，只准备 `docs/reviews/phaseN-review-brief.md`）；用户 = PM / 验收人，负责裁决。
- 与用户对话一律使用中文。
- 阶段顺序：产品设计 → UI 设计 → 编码 → 测试评测 → 优化 → 交付材料；每阶段经审查和 PM 确认后再进入下一阶段。
- 文档、注释使用中文。
- 密钥只放 `.env.local`，绝不写入源码或文档；提交前检查 `git diff --cached` 中没有 `sk-fish-`。
- Git 身份：`pany-05 <pany.panpan05@gmail.com>`（仓库级配置）。
- Maestro 路径：`~/.maestro/bin/maestro`。
- Pencil：PM 在 Pen 中打开的工作文件为 `~/.pencil/documents/b7e0384a-ab19-46ea-ae0b-f317e9741917/fishRN.pen`；项目内 `design/fishRN.pen` 是快照，改稿后需重新复制。
