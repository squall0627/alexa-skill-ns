// handlers/AfterAddDecisionHandler.js
// 日本語：AddCart 後の Yes/No の分岐を処理するハンドラ
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};

    // このハンドラは、ユーザーの Yes/No があり、直前のアクションが 'afterAdd' の場合に処理する
    if (Alexa.getRequestType(request) === 'IntentRequest' && sessionAttributes.lastAction === 'afterAdd') {
      return intentName === 'AMAZON.YesIntent' || intentName === 'AMAZON.NoIntent';
    }
    return false;
  },
  handle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    if (intentName === 'AMAZON.YesIntent') {
      // ユーザーは続けて検索したい
      // 状態をクリアして検索プロンプトへ
      delete sessionAttributes.lastAction;
      delete sessionAttributes.lastAdded;
      attributesManager.setSessionAttributes(sessionAttributes);

      const speak = '承知しました。何を検索しますか？ 商品名やカテゴリ、ブランド名でお知らせください。';
      const reprompt = 'どの商品を検索しますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
    }

    // NoIntent -> ユーザーはカート確認または精算に進みたい
    // ここでは簡易的にカート内容を読み上げるか、カートが空ならその旨を伝える
    const cart = sessionAttributes.cart || [];
    delete sessionAttributes.lastAction;
    delete sessionAttributes.lastAdded;
    attributesManager.setSessionAttributes(sessionAttributes);

    if (cart.length === 0) {
      const speak = '現在カートに商品は入っていません。続けて商品を検索しますか？';
      const reprompt = 'どの商品を検索しますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
    }

    // カートの簡単なサマリを作る（最大3件まで読み上げ）
    const itemsToRead = cart.slice(0, 3).map((p, i) => `番号${i + 1}、${p.name}、価格${p.price}円`).join('。 ');
    const more = cart.length > 3 ? ` 他に${cart.length - 3}件あります。` : '';
    const speak = `カートには${cart.length}件の商品があります。${itemsToRead}。${more}次はご注文に進みますか、それとも続けて検索しますか？`;
    const reprompt = 'ご注文に進みますか、それとも続けて検索しますか？';

    return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
  }
};
