# 测试音频

由 macOS `say` 与 `ffmpeg` 生成，用于导入校验与转写联调（PRD 验收 2、3）。

| 文件 | 预期结果 |
|---|---|
| `zh-short.mp3` | 通过，中文转写（约 7 秒） |
| `en-short.wav` / `en-short.m4a` | 通过，英文转写（约 4 秒） |
| `silence.wav` | 通过校验，转写为空 →"未识别到有效语音" |
| `too-short.mp3` | 时长 0.5 秒 → 时长不符 |
| `too-long.mp3` | 时长 75 秒 → 时长不符 |
| `too-large.wav` | 约 11MB（58 秒）→ 超过 10MB |
| `empty.mp3` | 0 字节 → 文件为空 |
| `corrupt.mp3` | 随机字节 → 无法读取 |
| `wrong-format.ogg` | 扩展名不支持 → 格式不符 |
| `fake-ext.mp3` | 扩展名为 mp3、实际为 Ogg → 格式不符（文件头校验） |
