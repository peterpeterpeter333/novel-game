# novel-game ── 没入書庫

小説を「読む」のではなく「体験する」ための、没入型テキストゲームのプラットフォーム。

## 内容

| パス | 内容 |
|---|---|
| `novel/` | 原作小説『壁打ち――観測社会の密室』全24話＋設計書 |
| `docs/GAME_DESIGN.md` | ゲーム企画書（コンセプト・拡張設計・ロードマップ） |
| `game/` | ゲーム本体（依存ゼロの素のHTML/CSS/JS） |
| `game/dist/kabeuchi_demo.html` | 1ファイル完結の配布版（これだけで動く） |

## 遊び方

- `game/dist/kabeuchi_demo.html` をブラウザで開く（スマホ縦画面推奨）
- または `game/index.html` をローカルサーバで開く

## 開発

- シナリオ追加: `game/scenarios/` に `NG.register({...})` するファイルを置き、`game/index.html` に script タグを1行追加
- 配布版の再生成: `node game/scripts/build-single.mjs`

詳細は `docs/GAME_DESIGN.md` を参照。
