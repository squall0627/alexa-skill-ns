// server.js - LLM バックエンドの簡易 Express サーバ
// 本番では HTTPS 経由でデプロイし、WAF/レート制限/監視を設定してください。
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const llmRoute = require('./routes/llm');
const analyzeIntentRoute = require('./routes/api/analyzeIntent');
const searchRouter = require('./routes/api/search');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// ヘルスチェック
app.get('/health', (req, res) => res.json({ok:true}));

// Intent分析専用エンドポイント
app.post('/api/analyze-intent', analyzeIntentRoute);

// 検索・閲覧・選択APIルート
app.use('/api/search', searchRouter);
app.use('/api/browse', searchRouter);
app.use('/api', searchRouter);

app.listen(PORT, () => console.log(`LLM backend listening on ${PORT}`));