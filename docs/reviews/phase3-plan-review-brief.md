# 阶段三审查说明：编码计划（PLAN）

> 供 PM 在 Codex 桌面端发起独立审查。请把下方"审查提示词"整段粘贴给 Codex，结果保存为 `docs/reviews/phase3-plan-codex.md`。

## 审查材料

| 材料 | 路径 |
|---|---|
| 题目 | `docs/ASSIGNMENT.md` |
| 需求 / 设计（已定稿） | `docs/PRD.md` v1.1、`docs/DESIGN.md` v0.4 |
| 编码计划（待审） | `docs/PLAN.md` v0.1 |
| 当前脚手架 | `package.json`、`app.json`、`src/app/`（M0 验证代码） |

## 审查提示词

```
你是资深 React Native / Expo 工程师，对本仓库的编码计划做独立审查。只读，不要修改任何文件。

背景：这是一个 Expo SDK 58 笔试项目（录音/导入 → Fish Audio 转写 → 编辑 → 选声音 → TTS 配音 → 试听/导出 → 本地历史）。PM 的决策方向是"让项目足够健壮，而不是吹毛求疵"：请只提出会影响稳定性、正确性、数据安全或验收通过的问题，形式偏好类意见请省略。

请阅读 docs/ASSIGNMENT.md、docs/PRD.md、docs/DESIGN.md、docs/PLAN.md，以及 package.json、app.json、src/app/ 下的现有代码。

审查维度：
1. 架构是否能可靠支撑 PRD 的状态机与异常处理（请求守卫、取消、快照、过期、持久化一致性）；是否有会导致数据错配、丢失或卡死的设计漏洞。
2. 所选 SDK 58 模块（expo-audio、expo-file-system 新 API、expo-document-picker、expo-sharing、expo-glass-effect、expo-symbols、expo-router native-tabs / formSheet）的用法是否存在已知坑或与平台能力不符之处；请尽量给出依据。
3. 里程碑顺序与粒度是否合理，是否有遗漏的验收项或高风险项应该提前验证。
4. 测试策略能否覆盖题目第 8 条（网络断开、超时、认证、额度、限流、接口错误、音频不完整、本地保存失败）。

输出格式（中文 Markdown）：
- 总体评价（3 句以内）
- 问题表：编号 | 严重度(高/中/低) | 位置 | 问题 | 建议
- 编码前必须修改的项（没有可写"无"）
控制在 1200 字以内。
```
