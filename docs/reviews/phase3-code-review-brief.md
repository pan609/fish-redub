# 阶段三审查说明：代码

> 供 PM 在 Codex 桌面端发起独立代码审查。请把下方"审查提示词"整段粘贴给 Codex，结果保存为 `docs/reviews/phase3-code-codex.md`。

## 审查材料

| 材料 | 路径 |
|---|---|
| 需求 / 设计 / 计划 | `docs/PRD.md` v1.2、`docs/DESIGN.md` v0.4、`docs/PLAN.md` v0.2（§5.1 为编码进度与联调修复记录） |
| 源码 | `src/`（`app/` 路由、`features/` 业务、`services/` 服务、`ui/` 组件） |
| 单元测试 | `src/__tests__/`（77 条，`npm test`） |

## 审查提示词

```
你是资深 React Native / Expo 工程师，对本仓库的实现代码做独立审查。只读，不要修改任何文件。

背景：Expo SDK 58 笔试项目（录音/导入 → Fish Audio 转写 → 编辑 → 选声音 → TTS 配音 → 试听/导出 → 本地历史）。PM 的决策方向是"让项目足够健壮，而不是吹毛求疵"：只提出会影响稳定性、正确性、数据安全或验收通过的问题，代码风格、命名偏好等请省略。

请先阅读 docs/ASSIGNMENT.md（题目与 9 条验收标准）、docs/PRD.md、docs/PLAN.md，再审查 src/ 下的代码，重点：
1. src/features/redub/machine.ts 与 store.ts：任务代次失效、取消、迟到响应、保存失败与重试保存、过期判定，是否存在竞态或状态错配。
2. src/services/fish/：超时、取消、错误归一化、TTS 完整性校验是否可靠。
3. src/services/storage/historyRepo.ts：每条记录独立元数据的提交、恢复、清理逻辑是否会丢数据或误删。
4. src/features/recorder/useRecorderSession.ts：权限、原生 60 秒上限、统一收尾防重入、后台结束、录音后音频会话恢复。
5. src/features/importer/importAudio.ts：校验顺序与边界（取消静默、空文件、超大、伪装扩展名、时长）。
6. 播放互斥（src/services/audio/coordinator.ts、src/ui/components/AudioPlayer.tsx）与导出（src/services/export.ts）。
7. 对照题目 9 条验收标准，指出未实现或实现有缺陷的点。

输出格式（中文 Markdown）：
- 总体评价（3 句以内）
- 问题表：编号 | 严重度(高/中/低) | 文件:行 | 问题 | 触发场景 | 建议
- 必须在进入测试阶段前修复的项（没有可写"无"）
控制在 1500 字以内。
```
