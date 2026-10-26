# 阶段二审查说明：UI 设计

> 供 PM 在 Codex 桌面端发起独立审查使用。请把下方"审查提示词"整段粘贴给 Codex，审查结果保存为 `docs/reviews/phase2-design-codex.md`。

## 审查材料

| 材料 | 路径 |
|---|---|
| 题目 | `docs/ASSIGNMENT.md` |
| 产品需求（已定稿） | `docs/PRD.md` v1.0 |
| 设计规范（待审） | `docs/DESIGN.md` v0.3 |
| 设计稿导出图 | `design/exports/01–15-*.png`（15 张），总览 `design/overview.jpg` |
| 视觉参考 | Fish Audio iOS App（App Store id6789369290）。商店截图在 `design/reference/`（仅本地，未入库） |

## 审查提示词

```
你是资深移动端 UI/UX 设计师兼 React Native 工程师，对本仓库做独立的设计审查。只读，不要修改任何文件。

请阅读：docs/ASSIGNMENT.md（题目）、docs/PRD.md（已定稿的需求）、docs/DESIGN.md（待审的设计规范），并逐张查看 design/exports/ 下的 15 张设计稿 PNG（以及 design/reference/ 下的 Fish Audio App 商店截图，如果存在）。

审查维度：
1. 需求覆盖：PRD 中每个 P0 需求和题目 9 条验收标准，在设计稿或 DESIGN.md 中是否有明确的界面表达；列出缺失或表达不清的状态（例如加载、空、错误、过期、权限、离线、文件不可用）。
2. 流程清晰度：题目要求"页面应清楚表达当前输入、处理阶段和下一步操作"。逐屏判断用户能否立即知道这三件事，指出含糊之处。
3. 风格一致性：与 Fish Audio App 的视觉语言（暖白底、橙色强调、黑色胶囊主按钮、暖灰次按钮、白色大圆角弹层、波形播放器）是否一致；设计稿与 DESIGN.md 的令牌、组件规格是否一致。
4. 可用性与无障碍：点击区域、对比度（特别是 text-tertiary 和未解锁卡片 45% 透明度下的文字）、单手操作、文字放大后的破版风险、深色模式问题。
5. 实现可行性：基于 Expo SDK 58（expo-router Native Tabs、expo-glass-effect、expo-symbols、原生 formSheet、expo-audio）在 iOS 与 Android 上实现的难点或高风险设计；双端差异是否合理。
6. 过度设计：哪些视觉或交互超出题目必要范围、性价比低。

输出格式（中文 Markdown）：
- 总体评价（3 句以内）
- 问题表：编号 | 严重度(高/中/低) | 位置(设计稿编号或 DESIGN 章节) | 问题 | 建议
- 最后列出你认为必须在编码前修改的 Top 3
控制在 1500 字以内，只写有实质价值的意见，不要复述文档。
```

## 本阶段 Claude 已知的取舍（供审查参考）

1. "生成配音"按钮从底部固定承托区改为卡片内（DESIGN §5.2 v0.2 变更说明）。
2. 部分状态未单独出图，按规范实现（DESIGN §7 末尾列表）。
3. 图标：设计稿用 Phosphor 近似 SF Symbols，开发时以 DESIGN §6.2 映射表为准；液态玻璃按 DESIGN §7 实现，设计稿中的模糊效果只是近似表达。
5. 头像使用 Fish Audio 公开模型的真实封面，其中"解说男声"封面为卡通形象。
4. 字体使用系统字体；设计稿中以 Noto Sans SC 代替。
