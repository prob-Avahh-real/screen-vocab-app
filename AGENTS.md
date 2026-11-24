# 屏词 (screen-vocab)

从屏幕 OCR / 字幕轨 / 粘贴取词，英→中释义卡片。

全生态：
- 苹果：iPhone / iPod / iPad / Mac Catalyst / Watch / TV / Vision 布局
- 安卓：手机 / 平板 / Wear / TV / ChromeOS / 折叠屏

输出：耳机 TTS、眼镜语音 HUD、头带回读。

## 用途与 Target 判定

| 平台 | 需要? | 方式 |
|------|-------|------|
| 移动端 | 需要 | Capacitor (`android/` + `ios/`) + 多形态响应式布局 |
| 智能硬件 | 需要 | `src/wearable-input.js` + `src/smart-outputs.js`（手表/眼镜 HUD/耳机回读） |

- Build: `npm run build`
- Test: `npm test`
- Start: `npm start` (port 5191)
- APK: `npm run apk:debug`
- iOS: `npm run mobile:ios`

## Harness / Loop（助手）

- 遵循根 `/Users/skat/AGENTS.md`：**Harness Engineering** + **Loop Engineering**
- Guide = 本文件；Sensor = 下方验证命令；同类失误第二次须沉淀规则或测试（棘轮）
- 开干前写清 **Done**；每切片过验证环；显式停止（成功 / 上限 / 无进展 / 人审）
- 详解：`docs/HARNESS_ENGINEERING.md`、`docs/LOOP_ENGINEERING.md`

## 验证环 / Done

```bash
npm install
npm test          # 若有
npm run build     # 或 build:web
npx cap sync android   # 若有 android/
# 可选：JAVA_HOME=…/openjdk@17 npm run apk:debug
```

**Done 示例**：测试通过（若有）+ web 产物进 `www/`/`dist/` + `cap sync` 无报错。可选穿戴未做可搁置，不纳入强制 Done。
