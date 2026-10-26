# Maestro 端到端测试

| 流程 | 内容 |
|---|---|
| `01-main-zh.yaml` | 中文主流程：导入 → 转写 → 编辑 → 生成 → 试听 → 历史详情 |
| `02-en-voice-expired.yaml` | 英文导入、默认英文声音、试听并切换声音、结果过期、重新生成 |
| `03-import-validation.yaml` | 导入校验：空文件、超长、过短、超大、伪装扩展名、损坏、不支持格式 |
| `04-empty-transcript.yaml` | 静音 → 未识别 → 手动输入（纯空白不能确认） |
| `05-faults.yaml` | 故障注入：断网、401、402、500、截断、非音频、429 倒计时、保存失败与重试保存 |
| `06-recorder.yaml` | 录音、计时、停止、预览、重录、使用此录音 |
| `07-history-persist-delete.yaml` | 重启后历史仍在；删除记录后主流程同步失效 |

`common/` 为子流程（启动、导入文件、走到确认文字、设置故障）。

运行前准备：开发构建已安装、Metro 已启动、测试音频已放入模拟器（见 `docs/TEST_REPORT.md` §5）。

```bash
~/.maestro/bin/maestro --device <设备 ID> test .maestro
```
