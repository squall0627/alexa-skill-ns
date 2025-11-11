// handlers/CancelAndStopIntentHandler.js
// 日本語：キャンセル/終了 Intent（AMAZON.CancelIntent / AMAZON.StopIntent）専用ハンドラ。
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
        || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    // 日本語：セッション終了時の別れの挨拶。
    const speechText = 'ご利用ありがとうございました。';
    return handlerInput.responseBuilder.speak(speechText).getResponse();
  }
};
