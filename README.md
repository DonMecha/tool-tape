# tool-tape

[日本語](README.md) | [English](README.en.md)

Claude Codeが1回の依頼の中で行ったツール呼び出しを、入力欄の上に色のマスで並べるmodです。何を何回行ったか、どこで失敗したか、どれくらい時間がかかっているかを、作業中にひと目で確認できます。

![作業中の表示](docs/running.png)

## 表示の読み方

```
進行 ▮▮▮▮▮▮ 6回 · 9秒  読3  実2  編1  失1
```

- **進行 / 前回**: 作業中は「進行」、依頼が終わると「前回」に変わり、最後の結果を残します。
- **色のマス**: ツール呼び出し1回につき1マス、古い順に左から並びます。40マスを超えた分は左端に `+12` のように数だけ出します。
- **6回 · 9秒**: 呼び出しの合計と、依頼を送ってからの経過時間です。作業中は毎秒更新します。
- **読3 実2 …**: 種類ごとの回数です。文字の色はマスの色と同じです。失敗はマスを赤にし、「失」で別に数えます。

| 色 | 種類 | 対象のツール |
|---|---|---|
| 水色 | 読（read） | Read, Grep, Glob, LS, NotebookRead |
| 黄 | 実（run） | Bash, BashOutput, KillShell, Monitor |
| 緑 | 編（edit） | Edit, Write, MultiEdit, NotebookEdit |
| 青 | 網（web） | WebFetch, WebSearch, Playwright MCP |
| 紫 | 委（agent） | Agent, Task, SendMessage |
| 灰 | 他（other） | 上記以外（MCPツールなど） |
| 赤 | 失（failed） | 拒否された、またはエラーを返した呼び出し |

作業中のスピナーの後ろにも、何回目の呼び出しかと直近のツール名を `… 6回目 · Write` のように足します。

![依頼が終わった後の表示](docs/last.png)

スクリーンショットは英語表示（`LANG=en_US.UTF-8`）で撮影しています。

## 動作要件

- Claude Code v2.1.287以降（modが標準で有効な版）。v2.1.291のLinuxターミナルで動作を確認しています。
- 表示されるのはターミナルとClaude DesktopのCodeタブです。VS Code拡張のチャット欄と `claude -p` では何も描画されません。呼び出しを数える処理だけが動きます。

## インストール

Claude Codeのセッションで次を実行します。

```
/plugin install tool-tape --marketplace DonMecha/tool-tape
```

マーケットプレイスの追加を確認されたら `y`、スコープは既定のユーザースコープを選びます。

インストールせずに試すときは、このリポジトリをcloneして次のように起動します。

```sh
claude --plugin-dir ./tool-tape
```

## 設定

表示言語は既定で `auto` です。`LC_ALL`・`LC_MESSAGES`・`LANG` の順に見て、`ja` で始まれば日本語、それ以外は英語で表示します。固定する場合は `/config` の設定欄で選ぶか、ユーザー設定ファイル（`settings.json`）に次のように書きます。

```json
{
  "pluginConfigs": {
    "tool-tape@tool-tape": { "options": { "language": "ja" } }
  }
}
```

止めるときは `claude plugin disable tool-tape@tool-tape` を実行します。

## 制約

- Claude Codeのmod APIは早期提供版で、予告なく変わることがあります。Claude Codeの更新で表示が崩れたり、動かなくなったりする可能性があります。
- 数えるのはこのmodを読み込んだ後の呼び出しだけです。履歴をさかのぼって集計はしません。セッションをまたいだ記録も残しません。
- 隣り合う同じ色のマスは、つながって1本の帯に見えます。
- このmodはファイル・ネットワーク・プロセスに触れません。読む環境変数は言語判定用の `LC_ALL`・`LC_MESSAGES`・`LANG` だけです。

## 開発

```sh
claude plugin validate .
claude plugin test .
```

## ライセンス

[MIT](LICENSE)
