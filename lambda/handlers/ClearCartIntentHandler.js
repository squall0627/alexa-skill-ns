// lambda/handlers/ClearCartIntentHandler.js
// 日本語：カートの中身だけをクリアするハンドラ（確認フロー対応）
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'ClearCartIntent';
  },
  handle(handlerInput) {
    console.log('Start handling ClearCartIntentHandler');
    try {
      const request = handlerInput.requestEnvelope;
      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};
      const { markLastAction } = require('../utils/sessionUtils');
      // mark last action as this intent
      markLastAction(handlerInput, 'ClearCartIntent');

      // Check built-in confirmation status (if interaction model uses confirmation)
      const intent = request.request.intent || {};
      const confirmationStatus = intent.confirmationStatus || 'NONE';

      if (confirmationStatus === 'CONFIRMED') {
        // perform clear using shared util
        const orderUtils = require('../utils/orderUtils');
        orderUtils.clearCartSession(attributesManager);

        // 改訂：カートを空にした後、続けて買うか買い物を終了するかを確認する
        const plain = 'カートの中身を空にしました。続けて他の商品を購入しますか、それとも買い物を終了しますか？ 続けて購入する場合は商品名で検索してください、買い物を終了する場合は「注文終了」と言ってください。どちらにしますか？';
        const reprompt = '続けて購入するなら商品名で検索してください、買い物を終えるなら「注文終了」と言ってください。';
        const ssml = `<speak>カートの中身を空にしました。<break time="300ms"/>続けて他の商品を購入しますか、それとも買い物を終了しますか？ 続けて購入する場合は商品名で検索してください、買い物を終了する場合は「注文終了」と言ってください。どちらにしますか？</speak>`;
        const rb = handlerInput.responseBuilder.speak(ssml).reprompt(reprompt);
        if (typeof rb.withSimpleCard === 'function') rb.withSimpleCard('カートを空にしました', plain);
        return rb.getResponse();
      }

      if (confirmationStatus === 'DENIED') {
        // ユーザーがクリアを否定した場合も次の行動を選べるよう促す
        const plain = 'カートのクリアをキャンセルしました。続けて買い物をしますか、それとも終了しますか？ 続けて買う場合は商品名で検索してください、終了する場合は「注文終了」と言ってください。';
        const reprompt = '続けて買い物するなら商品名で検索してください、終了するなら「注文終了」と言ってください。';
        const ssml = `<speak>カートのクリアをキャンセルしました。続けて買い物をしますか、それとも終了しますか？ 続けて買う場合は商品名で検索してください、終了する場合は「注文終了」と言ってください。</speak>`;
        const rb = handlerInput.responseBuilder.speak(ssml).reprompt(reprompt);
        if (typeof rb.withSimpleCard === 'function') rb.withSimpleCard('カートクリアをキャンセル', plain);
        return rb.getResponse();
      }

      // confirmationStatus === 'NONE' -> ask for confirmation and set generic pending flag
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'clearCart' };
      attributesManager.setSessionAttributes(sessionAttributes);

      const plain = 'カートの中身を全部消してもよろしいですか？はい、または、いいえ、で回答してください。';
      const reprompt = 'カートを空にしてもよいですか？ はい、で確定、いいえ、で中止します。';
      const ssml = `<speak>${plain}</speak>`;
      const rb = handlerInput.responseBuilder.speak(ssml).reprompt(reprompt);
      if (typeof rb.withSimpleCard === 'function') rb.withSimpleCard('カートクリアの確認', plain);
      return rb.getResponse();
    } finally {
      console.log('End handling ClearCartIntentHandler');
    }
  }
};
