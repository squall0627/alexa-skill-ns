// handlers/SessionEndedRequestHandler.js
// 日本語：セッション終了リクエスト（SessionEndedRequest）専用ハンドラ。
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    // 日本語：セッション終了時のクリーンアップ（必要に応じて）。
    return handlerInput.responseBuilder.getResponse();
  }
};
