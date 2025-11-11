// services/intentAnalyzer.js
// 日本語：ユーザーの自由発話をLLMで分析し、構造化されたIntent形式に変換するサービス

const OpenAI = require('openai');
require('dotenv').config();

// OpenAI クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY
});

/**
 * LLMを使ってユーザーの発話から意図を抽出する
 * @param {string} userText - ユーザーの発話
 * @param {object} intentsData - Intent定義データ（intents.jsonの内容）
 * @param {object} context - セッションコンテキスト（オプション）
 * @returns {Promise<{intent: string, params: object, handler: string}>}
 */
async function analyzeIntent(userText, intentsData, context = {}) {
  // 日本語：OpenAI APIを使用してユーザーの発話から意図を抽出
  
  try {
    // 日本語：コンテキスト情報を構築（カート状態、直近のリストなど）
    const contextInfo = buildContextInfo(context);
    
    // 日本語：LLMに送るプロンプトを構築
    const prompt = `Analyze the user's input and extract the most appropriate intent and parameters.

## Available Intent Definitions:
${JSON.stringify(intentsData.intents, null, 2)}

## Current Session Context:
${contextInfo}

## User Input:
"${userText}"

## Instructions:
1. Select the best matching intent from the definitions above
2. Extract required parameters (slot values) from user input
3. Include the corresponding handler name
4. Output ONLY valid JSON (no additional text)

## Output Format:
{
  "intent": "IntentName",
  "params": {
    "SlotName": "value"
  },
  "handler": "IntentHandlerName"
}`;

    // 日本語：OpenAI APIを呼び出し
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert intent classifier. Analyze user input and respond ONLY with valid JSON, no additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    // 日本語：レスポンスからJSONを抽出
    const responseText = completion.choices[0].message.content.trim();
    const result = JSON.parse(responseText);
    
    console.log(`[OpenAI Analysis] Input: "${userText}" → Intent: ${result.intent}, Handler: ${result.handler}, Params:`, result.params);
    
    return {
      intent: result.intent || 'AMAZON.HelpIntent',
      params: result.params || {},
      handler: result.handler || 'HelpIntentHandler'
    };
    
  } catch (error) {
    console.error('[OpenAI API エラー]', error.message);
    
    // 日本語：エラー時はフォールバック処理（簡易的なキーワードマッチング）
    return fallbackAnalyze();
  }
}

/**
 * セッションコンテキストを文字列に整形
 */
function buildContextInfo(context) {
  const info = [];
  
  if (context.cart && context.cart.length > 0) {
    info.push(`カート内商品: ${context.cart.length}点`);
  } else {
    info.push('カート: 空');
  }
  
  if (context.lastList && context.lastList.length > 0) {
    info.push(`直近の検索結果: ${context.lastList.length}件`);
  }
  
  if (context.pendingAction) {
    info.push(`保留中のアクション: ${context.pendingAction.type}`);
  }
  
  if (context.lastOrder) {
    info.push(`最後の注文: ${context.lastOrder.orderNo} (${context.lastOrder.status})`);
  }
  
  return info.length > 0 ? info.join(', ') : 'なし';
}

/**
 * エラー時のフォールバック分析（簡易キーワードマッチング）
 * @returns {{intent: string, params: object, handler: string}}
 */
function fallbackAnalyze() {
  let intent = 'AMAZON.HelpIntent';
  let params = {};
  let handler = 'HelpIntentHandler';
  
  return { intent, params, handler };
}

module.exports = {
  analyzeIntent
};
