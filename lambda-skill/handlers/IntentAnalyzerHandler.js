// handlers/IntentAnalyzerHandler.js
// 日本語：Alexa NLUが理解できなかった発話をLLMで分析し、適切なHandlerにルーティングするフォールバックハンドラ。
// 日本語：バックエンドで意図を分析し、Intent名とパラメータを取得後、対応するハンドラを呼び出して実行結果を返します。
const Alexa = require('ask-sdk-core');
const { postJson, toUserError } = require('../helpers/apiClient');
const fs = require('fs');
const path = require('path');

// 日本語：Intent定義をキャッシュ（初回読み込み時のみ実行）
let intentsCache = null;
function getIntentsDefinition() {
  if (!intentsCache) {
    const intentsPath = path.join(__dirname, '../config/intents.json');
    intentsCache = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));
    console.log('[IntentAnalyzerHandler] Intent定義をキャッシュしました');
  }
  return intentsCache;
}

// 日本語：ハンドラを動的にロードするヘルパー関数
function loadHandler(handlerName) {
  try {
    // 日本語：ハンドラ名からファイル名を生成（例: SearchProductIntent → SearchProductIntentHandler）
    const handlerFileName = handlerName.includes('Handler') ? handlerName : `${handlerName}Handler`;
    return require(`./${handlerFileName}`);
  } catch (err) {
    console.error(`[IntentAnalyzerHandler] ハンドラ "${handlerName}" のロードに失敗:`, err.message);
    return null;
  }
}


module.exports = {
  canHandle(handlerInput) {
    // 日本語：IntentRequest を全受け（ただし、個別ハンドラが先に処理される前提で最後に配置）
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
  },
  
  async handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || {};

    // 日本語：ユーザーの発話原文（inputTranscript）を取得
    const userSpoken = requestEnvelope.request.inputTranscript || intent.name || '';

    // 日本語：セッション属性を取得
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    // 日本語：Intent定義をキャッシュから取得
    const intentsDefinition = getIntentsDefinition();

    try {
      // 日本語：バックエンドでIntent分析を実行
      console.log(`[IntentAnalyzerHandler] ユーザー入力を分析中: "${userSpoken}"`);
      
      const analyzed = await postJson('/analyze-intent', {
        userText: userSpoken,
        intents: intentsDefinition,
        sessionContext: sessionAttributes,
      });
      const { intent: analyzedIntent, params, handler: handlerName } = analyzed;

      console.log(`[IntentAnalyzerHandler] 分析結果 - Intent: ${analyzedIntent}, Handler: ${handlerName}, パラメータ:`, params);

      // 日本語：ハンドラを動的にロード
      const handler = loadHandler(handlerName);
      
      if (handler) {
        // 日本語：handlerInputのintentNameとslotsを解析結果で置き換え
        handlerInput.requestEnvelope.request.intent = {
          name: analyzedIntent,
          confirmationStatus: 'NONE',
          slots: {}
        };
        
        // 日本語：paramsをAlexaのslot形式に変換
        for (const [key, value] of Object.entries(params)) {
          handlerInput.requestEnvelope.request.intent.slots[key] = {
            name: key,
            value: value,
            confirmationStatus: 'NONE'
          };
        }
        
        // 日本語：対応するハンドラを呼び出し
        console.log(`[IntentAnalyzerHandler] ${handlerName}ハンドラを呼び出し中...`);
        return await handler.handle(handlerInput);
      } else {
        // 日本語：ハンドラが見つからない場合、エラーを返す
        console.log(`[IntentAnalyzerHandler] ${handlerName}用のハンドラが見つかりません。`);
        const err = toUserError('該当するハンドラが見つかりませんでした。もう一度お試しください。');
        return handlerInput.responseBuilder
          .speak(err.spokenResponse)
          .reprompt(err.reprompt)
          .getResponse();
      }
    } catch (err) {
      console.error('[IntentAnalyzerHandler] エラー:', err);
      return handlerInput.responseBuilder
        .speak('申し訳ありません。現在リクエストを処理できません。少し時間をおいてもう一度お試しください。')
        .reprompt('もう一度お試しください。')
        .getResponse();
    }
  }
};
