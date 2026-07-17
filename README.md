# 屏词 · screen-vocab

从屏幕 OCR / 字幕轨 / 粘贴截图取英文字幕，判定有字幕后才允许取词，输出释义、例句、近义词、使用场景。

## 平台

| 目标 | 说明 |
|------|------|
| **Android** | Capacitor APK（`npm run apk:debug`） |
| **iPhone / iPod** | Capacitor iOS，紧凑单栏布局 |
| **iPad** | 通用 App（device family 1,2），双栏布局 |
| **MacBook** | Mac Catalyst（`SUPPORTS_MACCATALYST`），桌面双栏 |
| **Apple Watch** | 精简 companion UI（词 + 释义 + 取词）；窄屏自动切换 |

输出端：耳机 TTS、眼镜语音 HUD、头带回读；输入：戒指 / 手杖。

## 触发闸门

`可取词` 仅当：源已就绪 + 文本通过字幕检测 + 非忙碌。否则主按钮禁用；戒指晃动 / 手杖敲击 / 语音「取词」静默忽略。

## 三路输入

| 模式 | 说明 |
|------|------|
| 粘贴/截图 | 文本框或图片 OCR（裁底部 28% 字幕带） |
| 屏幕 | `getDisplayMedia` 抓帧，或相册截图 OCR |
| 字幕轨 | 导入 SRT/VTT + 可选本地视频时间轴 |

## 命令

```bash
npm install
npm test
npm start              # http://localhost:5191
npm run apk:debug      # Android
npm run mobile:ios     # sync + 打开 Xcode（选 iPhone / iPad / My Mac）
```

修改源码后：`npm run build` → `npx cap sync`。

在 Xcode 中：Scheme 目标可选模拟器 iPhone / iPad，或 **My Mac (Mac Catalyst)**。Apple Watch 使用手机端精简布局（同包 companion UI），非独立 watchOS 二进制。

## 可穿戴

| 手势 | 动作 |
|------|------|
| 戒指晃动 / 手杖敲击 | 取词（需闸门打开） |
| 戒指左右倾 | 上一/下一词卡 |
| 键盘 E / ← → | 取词 / 翻卡 |
