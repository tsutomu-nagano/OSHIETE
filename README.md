# OSHIETE — e-Stat 初心者モード

e-Statのページに表示された統計用語を検出し、その場でやさしい説明を表示するChrome / Microsoft Edge向けブラウザ拡張のPoCです。e-Stat本体には手を加えず、Manifest V3のContent Scriptから必要なTextNodeだけを安全にマークします。

## 実装内容

- Aho–Corasick法で辞書の用語と別名を一括検索し、長い語から優先して検出
- 用語を点線で表示し、ホバーで短い説明を表示
- クリック、Enter / Space、右クリックで右側の詳細ドロワーを表示
- ドロワー内の登録済み関連用語から、次の用語解説へ移動
- 詳細ドロワーに見出しアイコンと、資料名・発行者・取得日を含む出典を表示
- 動的に追加されたDOMを`MutationObserver`で差分処理
- ポップアップから初心者モードをON / OFF（設定はブラウザに保存）
- e-Stat画面右上の「教えてモード」スイッチからもON / OFF
- ページごとの検出件数をポップアップに表示
- TooltipとドロワーをShadow DOM内に配置し、サイト側CSSとの干渉を防止

外部ライブラリやCDNは使用していません。

## Chromeでの導入方法

1. `chrome://extensions` を開く
2. 右上の「デベロッパー モード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」を選ぶ
4. このリポジトリのルートフォルダ（`manifest.json`があるフォルダ）を指定する

## Microsoft Edgeでの導入方法

1. `edge://extensions` を開く
2. 「開発者モード」をONにする
3. 「展開して読み込み」を選ぶ
4. このリポジトリのルートフォルダを指定する

ファイルを変更した後は、拡張機能管理画面の再読み込みボタンを押し、対象のe-Statページも再読み込みしてください。

## 使い方と動作確認

1. 拡張機能を読み込み、[e-Stat](https://www.e-stat.go.jp/)を開く
2. 「統計表」「政府統計」などに点線が付くことを確認する
3. ホバーでTooltip、クリックまたは右クリックで右側の詳細ドロワーが表示されることを確認する
4. 拡張機能アイコンをクリックし、検出件数とON / OFFを確認する
5. OFFでマークが取り除かれ、ONで再検出されることを確認する

## ファイル構成

```text
.
├── manifest.json
├── background/service-worker.js
├── content/
│   ├── content.js              # 初期化、設定、各機能の連携
│   ├── aho-corasick.js         # Trieとfailure linkによる用語検索
│   ├── term-marker.js          # TextNode探索と用語マーク
│   ├── mutation-observer.js    # 動的DOMの差分監視
│   └── term-styles.css
├── dictionary/
│   ├── terms.json              # 用語辞書
│   ├── sources.json            # 用語の抽出元（出典）
│   └── pages.json              # 将来のページガイド用定義例
├── ui/
│   ├── ui.js                   # Tooltip、ドロワー、イベント
│   └── styles.css
└── popup/
    ├── popup.html
    ├── popup.js
    └── popup.css
```

## 辞書への用語追加

`dictionary/terms.json`の配列へ次の形式で追加します。`id`は辞書内で重複しない識別子にしてください。

```json
{
  "id": "population_density",
  "term": "人口密度",
  "aliases": [],
  "shortDescription": "一定の面積あたりに住む人口を示します。",
  "description": "人口を面積で割り、地域の人口の集中度を表す指標です。",
  "examples": ["1平方キロメートルあたりの人口"],
  "relatedTerms": ["人口", "地域区分"],
  "category": "人口統計",
  "difficulty": 2
}
```

用語と別名はAho–Corasick法で一括検索されます。同じ位置から始まる候補は文字数の長いものが優先されるため、「人口」と「人口密度」の両方を登録しても「人口密度」が選択されます。

### 出典の管理

外部資料から抽出した用語の出典は`dictionary/sources.json`で管理します。各出典には一意な`id`、資料名、URL、発行者、取得日と、その出典から作成した用語の`termIds`を記録します。`termIds`には`terms.json`に存在する用語IDだけを指定し、同じ用語IDを複数の出典へ登録することもできます。

## 安全性と現時点の制約

- `innerHTML`によるページ全体の置換は行わず、対象TextNodeだけを`span`へ分割します。
- リンクの遷移を妨げないよう、アンカータグ内の文字列は用語検出の対象外です。
- e-Statの絞り込み操作を妨げないよう、`.stat-filter-list-item`内も用語検出の対象外です。
- OFF時は追加した`span`をTextNodeへ戻し、隣接TextNodeを正規化します。
- 動的DOMは追加されたNodeだけを100ms単位でまとめて探索します。
- iframe内、閉じたShadow DOM内、Canvas上の文字は検出しません。
- 既存TextNode自体の書き換えだけが起きた場合は検出しません。
- 右クリックは登録用語上に限り標準メニューを抑止します。
- `pages.json`は将来拡張用で、ページガイド表示は未実装です。

## 今後の拡張ポイント

- `pages.json`を使った画面要素ガイド
- 初心者 / 一般 / 専門家モード別の説明
- 関連用語間の移動、辞書検索、お気に入り、閲覧履歴
- チュートリアルとページ遷移をまたぐ操作案内
- 辞書規模が大きくなった場合の検索エンジン差し替え
