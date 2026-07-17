# 屏词 · screen-vocab

从屏幕 OCR / 字幕轨 / 粘贴截图取英文字幕，判定有字幕后才允许取词，输出释义、例句、近义词、使用场景。

## 全生态适配

### 苹果

| 形态 | 布局 | 原生 |
|------|------|------|
| iPhone / iPod | 手机单栏 + safe-area | Capacitor iOS |
| iPad | 平板双栏 | Universal（family 1,2） |
| MacBook | 桌面双栏 | Mac Catalyst |
| Apple Watch | 精简 companion（词+释义+取词） | 同包窄屏 UI |
| Apple TV | 10-foot 大字/焦点 | Web TV 布局 |
| Vision | 大画布桌面密度 | 同 iOS/Catalyst 壳 |

### 安卓

| 形态 | 布局 | 原生 |
|------|------|------|
| 手机 | 单栏 + safe-area | Capacitor APK |
| 平板 | 双栏 | `supports-screens` 全尺寸 |
| 折叠屏 | 展开双栏 | `resizeableActivity` + segments |
| Wear OS | 精简 companion | 可选 watch feature；窄屏 UI |
| Android TV | 10-foot + Leanback 入口 | `LEANBACK_LAUNCHER` |
| ChromeOS | 桌面双栏 | 同 APK，可窗口化 |

输出端：耳机 TTS、眼镜语音 HUD、头带回读；输入：戒指 / 手杖。

> Watch / TV / Vision 为 **同一 Web 壳的形态适配**（非独立 watchOS / tvOS 二进制）。真机以对应模拟器或设备 UA/视口验证。

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
npm run apk:debug      # Android（手机/平板/TV/ChromeOS）
npm run mobile:ios     # sync + Xcode（iPhone / iPad / My Mac）
```

修改源码后：`npm run build` → `npx cap sync`。

## 可穿戴

| 手势 | 动作 |
|------|------|
| 戒指晃动 / 手杖敲击 | 取词（需闸门打开） |
| 戒指左右倾 | 上一/下一词卡 |
| 键盘 E / ← → | 取词 / 翻卡 |
