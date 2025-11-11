# Intent分析アーキテクチャ

## 概要

このAlexaスキルは、ユーザーの自由な発話を理解し、適切なIntentに変換して処理する機能を実装しています。

## アーキテクチャフロー

```
ユーザーの発話
    ↓
Alexa Lambda (LLMForwarderHandler)
    ↓
LLMバックエンド (intentAnalyzer)
    ↓
Intent分析・パラメータ抽出
    ↓
該当するIntentハンドラで処理
    ↓
音声レスポンス
```

## 主要コンポーネント

### 1. Intent定義ファイル (`lambda-skill/config/intents.json`)

全てのIntent定義を一元管理するJSONファイル。各Intentには以下が含まれます：
- `name`: Intent名
- `description`: 説明（日本語）
- `parameters`: パラメータ定義
- `examples`: 発話例（日本語）

**例：**
```json
{
  "name": "AddToCartIntent",
  "description": "商品をカートに追加する",
  "parameters": {
    "ProductId": "商品ID",
    "Quantity": "数量"
  },
  "examples": [
    "カートに追加して",
    "これを2個カートに入れて",
    "3つカートに入れる",
    "牛乳を2本カートに追加"
  ]
}
```

### 2. Intent分析サービス (`llm-backend/services/intentAnalyzeService.js`)

ユーザーの自由発話から意図を分析し、構造化されたIntent形式に変換します。

**現在の実装：** キーワードマッチングによるルールベース
**将来の実装：** OpenAI/Anthropic等のLLM APIを使用した高度な意図理解

**入力例：**
```javascript
{
  userText: "牛乳を2本カートに入れて",
  context: { ... }
}
```

**出力例：**
```javascript
{
  intent: "AddToCartIntent",
  params: {
    Quantity: "2"
  }
}
```

### 3. LLMバックエンドルート (`llm-backend/routes/llm.js`)

1. Intent分析を実行（intentNameが無い場合）
2. 分析結果のパラメータを既存のslotsとマージ
3. 該当するIntentロジックを実行
4. レスポンスを返す

**処理フロー：**
```javascript
// Intent分析
if (!intentName && userText) {
  const analyzed = await analyzeIntent(userText, state);
  intentName = analyzed.intent;
  params = analyzed.params;
}

// パラメータマージ
const mergedSlots = { ...analyzedParams, ...slots };

// Intent処理
if (intentName === 'AddToCartIntent') {
  const qty = mergedSlots.Quantity || '1';
  // カート追加処理...
}
```

### 4. Lambda フォワーダーハンドラ (`lambda-skill/handlers/IntentAnalyzerHandler.js`)

未実装のIntentをLLMバックエンドに転送するフォールバックハンドラ。
バックエンドでIntent分析と処理が行われ、結果を受け取ってAlexaレスポンスを生成します。

## Intent一覧

### 商品検索・閲覧
- **SearchProductIntent**: 商品を検索する
  - 例：「牛乳を探して」「明治の商品を見せて」
- **BrowseCategoryIntent**: カテゴリごとに商品を閲覧する
  - 例：「牛乳カテゴリを見せて」
- **SelectItemIntent**: リストから特定の番号のアイテムを選択する
  - 例：「1番目を選んで」「最初の商品」

### カート操作
- **AddToCartIntent**: 商品をカートに追加する
  - 例：「カートに追加して」「これを2個カートに入れて」
- **ViewCartIntent**: カートの中身を確認する
  - 例：「カートを見せて」「何が入ってる？」
- **RemoveFromCartIntent**: カートから商品を削除する
  - 例：「1番目を削除」「2番目をカートから消して」

### 注文処理
- **CheckoutIntent**: 注文を確定する前に確認する
  - 例：「お会計」「注文したい」
- **ConfirmOrderIntent**: 注文を確定する
  - 例：「注文確定」「この内容で注文」
- **OrderStatusIntent**: 注文状況を確認する
  - 例：「注文状況は？」「注文はどうなってる？」
- **CancelOrderIntent**: 注文をキャンセルする
  - 例：「注文をキャンセルして」「やっぱりやめる」

### その他
- **ChooseFulfillmentIntent**: 受け取り方法を選択する
  - 例：「店舗で受け取りたい」「配送にして」
- **ApplyCouponIntent**: クーポンを適用する
  - 例：「P10MILKを適用して」
- **PromotionsIntent**: プロモーション情報を確認する
  - 例：「キャンペーンは？」「何かお得なことある？」

### Amazon標準Intent
- **AMAZON.NextIntent**: 次のページ
- **AMAZON.PreviousIntent**: 前のページ
- **AMAZON.YesIntent**: はい
- **AMAZON.NoIntent**: いいえ
- **AMAZON.HelpIntent**: ヘルプ
- **AMAZON.StopIntent**: 終了
- **AMAZON.CancelIntent**: キャンセル

## 使用例

### 例1: 自由発話でカート追加

**ユーザー:** 「牛乳を2本カートに入れて」

**処理フロー:**
1. LLMForwarderHandlerがバックエンドに転送
2. intentAnalyzerが分析:
   ```javascript
   { intent: "AddToCartIntent", params: { Quantity: "2" } }
   ```
3. AddToCartIntentハンドラが実行
4. レスポンス: 「明治 おいしい牛乳 1Lを2点、カートに追加しました。ほかに必要なものはありますか？」

### 例2: 注文状況確認

**ユーザー:** 「注文はどうなってる？」

**処理フロー:**
1. intentAnalyzerが分析:
   ```javascript
   { intent: "OrderStatusIntent", params: {} }
   ```
2. OrderStatusIntentハンドラが実行
3. レスポンス: 「注文番号O123456の状況は「受付済み」です。」

### 例3: クーポン適用

**ユーザー:** 「P10MILKを適用して」

**処理フロー:**
1. intentAnalyzerが分析:
   ```javascript
   { intent: "ApplyCouponIntent", params: { CouponCode: "P10MILK" } }
   ```
2. ApplyCouponIntentハンドラが実行
3. レスポンス: 「牛乳カテゴリ 10%オフ クーポンを適用しました。現在の合計に割引が反映されます。」

## LLM API統合（将来の実装）

`intentAnalyzeService.js`の`analyzeIntentWithLLM`関数でLLM APIを統合できます：

```javascript
async function analyzeIntentWithLLM(userText, context = {}) {
  const prompt = `
あなたはAlexaスキルのIntent分類器です。
ユーザーの発話を分析し、以下のIntent定義から最も適切なIntentを選択し、パラメータを抽出してください。

## 利用可能なIntent定義:
${JSON.stringify(intentsData.intents, null, 2)}

## ユーザーの発話:
"${userText}"

## 出力形式（JSON）:
{
  "intent": "IntentName",
  "params": {
    "paramName": "value"
  }
}
`;

  // OpenAI/Anthropic APIを呼び出し
  const response = await callLLMAPI(prompt);
  return JSON.parse(response);
}
```

## カスタマイズ方法

### 新しいIntentを追加する

1. `lambda-skill/config/intents.json`に定義を追加
2. `llm-backend/services/intentAnalyzeService.js`にパターンマッチングルールを追加
3. `llm-backend/routes/llm.js`に処理ロジックを追加
4. （オプション）個別ハンドラを作成して`lambda-skill/index.js`に登録

### LLM APIを統合する

1. 環境変数にAPIキーを設定
2. `intentAnalyzeService.js`にLLM APIクライアントを実装
3. `analyzeIntent`関数を`analyzeIntentWithLLM`に置き換え

## まとめ

このアーキテクチャにより：
- ✅ ユーザーは自由な言葉でスキルを操作できる
- ✅ Intent定義が一元管理されて保守性が高い
- ✅ LLM APIへの移行が容易
- ✅ 構造化されたIntent・パラメータで処理が統一される
