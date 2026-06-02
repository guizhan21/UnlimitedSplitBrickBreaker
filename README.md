# 無限分裂打磚塊

Next.js + TypeScript + Canvas 2D 製作的 Many Bricks Breaker 風格關卡制打磚塊遊戲。

## 特色

- 108 個固定種子關卡。
- 正方形高密度小磚塊，Level 1 起至少 400 個可破壞磚塊。
- Level 91-108 至少 1200 個可破壞磚塊。
- 所有关卡固定 `POWER_DROP_RATE = 0.5`，約 50% 可破壞磚塊帶道具。
- 道具比例：x2 約 50%、+3 約 30%、WIDE/寬 約 20%。
- x2 會讓目前所有 active balls 翻倍，沒有球數上限。
- +3 會從擋板發射三顆小球。
- WIDE/寬 會讓擋板變寬約 16 秒，重複取得會刷新時間。
- 金屬磚塊不可摧毀、不掉道具、不計入通關條件。
- 每關清除所有可破壞磚塊後會暫停球與碰撞，顯示「關卡完成」結算畫面與煙火效果。
- 通關畫面會顯示本關分數、目前總分、獎勵分數，玩家可按「下一關」或等待倒數自動前進。
- 支援 localStorage 保存最高分、最高解鎖關卡、最後遊玩關卡、音訊與除錯設定。
- Debug/除錯面板預設隱藏，不覆蓋 Canvas 右下角。
- 切換 App、鎖屏、切換分頁或頁面不可見時會暫停音樂與遊戲更新。
- GitHub push 觸發 Vercel 自動部署。

## 執行

```powershell
Set-Location "D:\Codex_Web_Games\UnlimitedSplitBrickBreaker"
pnpm install
pnpm run dev
```

開啟 `http://localhost:3000`。

## 驗證

每次修改後都要執行：

```powershell
pnpm run build
pnpm run lint
pnpm exec tsc --noEmit
```

全部通過後再：

```powershell
git add .
git commit -m "<change summary>"
git push
```

Vercel 會根據 GitHub `main` 分支自動部署。

## 操作

- 滑鼠或觸控控制底部擋板。
- 按「開始」或點擊 Canvas 發射小球。
- 按「靜音」可切換音樂與音效。
- 按「除錯」可顯示或隱藏除錯面板。
