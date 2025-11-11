// routes/analyzeIntent.js
// 日本語：ユーザーの発話をIntent分析のみ行い、構造化されたIntent+パラメータを返すエンドポイント

const { analyzeIntent } = require('../../services/intentAnalyzeService');

const BACKEND_SECRET = process.env.BACKEND_SECRET;

module.exports = async (req, res) => {
  // 日本語：Alexa スキルからのシークレット検証
  const incomingSecret = req.headers['x-backend-secret'];
  if (!incomingSecret || incomingSecret !== BACKEND_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { userText, intents, sessionContext } = req.body || {};
  
  if (!userText) {
    return res.status(400).json({ error: 'missing userText' });
  }
  
  if (!intents) {
    return res.status(400).json({ error: 'missing intents definition' });
  }

  try {
    // 日本語：Intent分析を実行（LLMまたはフォールバック）
    const analyzed = await analyzeIntent(userText, intents, sessionContext || {});
    
    // 日本語：構造化されたIntent+パラメータ+ハンドラ名を返す
    return res.json({
      intent: analyzed.intent,
      params: analyzed.params || {},
      handler: analyzed.handler
    });
  } catch (err) {
    console.error('Intent分析エラー:', err);
    return res.status(500).json({ error: 'intent analysis failed' });
  }
};
