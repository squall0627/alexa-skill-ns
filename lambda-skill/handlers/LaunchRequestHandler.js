// handlers/LaunchRequestHandler.js
// 日本語：スキル起動時のハンドラ。
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    // 日本語：LaunchRequest のみを処理
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    // 日本語：スキル起動時の案内。スーパー機能のガイダンスを提示。
    const speechText = 'ようこそ、マイ・スーパーへ。商品を探す、カートを見る、注文する、クーポンやセールを確認できます。例えば、「牛乳を検索」や「カートを見せて」と話しかけてください。';
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt('何をしますか？例えば「牛乳を検索」と言ってください。')
      .getResponse();
  }
};
