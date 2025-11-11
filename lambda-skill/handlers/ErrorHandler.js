// handlers/ErrorHandler.js
// 日本語：エラーハンドラ。Alexa NLUが理解できなかった場合、IntentAnalyzerHandlerにフォールバックします。
const Alexa = require('ask-sdk-core');
const IntentAnalyzerHandler = require('./IntentAnalyzerHandler');

module.exports = {
  canHandle() {
    return true;
  },
  async handle(handlerInput, error) {
    console.error('Error handled:', error.stack || error);
    
    // 日本語：Alexa NLUが理解できなかった場合、LLMで再解析を試みる
    const requestType = Alexa.getRequestType(handlerInput.requestEnvelope);
    if (requestType === 'IntentRequest') {
      try {
        console.log('[ErrorHandler] Alexa NLUが失敗。IntentAnalyzerHandlerにフォールバック...');
        return await IntentAnalyzerHandler.handle(handlerInput);
      } catch (fallbackError) {
        console.error('[ErrorHandler] IntentAnalyzerHandlerもエラー:', fallbackError);
      }
    }
    
    // 日本語：最終的なエラーレスポンス
    return handlerInput.responseBuilder
      .speak('申し訳ありません。エラーが発生しました。もう一度お試しください。')
      .reprompt('恐れ入りますが、もう一度お願いします。')
      .getResponse();
  },
};
