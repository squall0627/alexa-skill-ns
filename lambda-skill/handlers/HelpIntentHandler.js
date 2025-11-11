// handlers/HelpIntentHandler.js
// 日本語：ヘルプ Intent（AMAZON.HelpIntent）専用ハンドラ。
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    // 日本語：ヘルプの案内。
    const speechText = 'このスキルでは、商品検索、カート操作、注文、注文状況の確認、クーポン適用ができます。例えば「牛乳を検索」「最初のアイテムをカートに追加」と言ってください。';
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt('何をしますか？')
      .getResponse();
  }
};
