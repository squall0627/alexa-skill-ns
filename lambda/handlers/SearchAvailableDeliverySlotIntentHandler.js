// lambda/handlers/SearchAvailableDeliverySlotIntentHandler.js
// 日本語：利用可能な配送枠を検索して提示するハンドラ（原 SelectDeliverySlotIntentHandler -> 重命名）
const Alexa = require('ask-sdk-core');
const DeliverySlotService = require('../services/DeliverySlotService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'SearchAvailableDeliverySlotIntent';
  },

  async handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots ? Object.fromEntries(Object.entries(intent.slots).map(([k, v]) => [k, v && v.value])) : {};

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    // mark lastAction early so follow-up handlers (e.g. SelectDeliverySlotIntent) can rely on it
    const { markLastAction } = require('../utils/sessionUtils');
    markLastAction(handlerInput, 'SearchAvailableDeliverySlotIntent');

    try {
      // カートの存在チェック
      const cart = sessionAttributes.cart || [];
      if (!cart || cart.length === 0) {
        const speak = 'カートに商品が入っていません。先に商品を選んでください。どの商品を探しますか？';
        return handlerInput.responseBuilder.speak(speak).reprompt('どの商品を探しますか？').getResponse();
      }

      // ユーザーが日付／時間を指定した場合はそれを使う
      const date = slots.Date || undefined; // 期待される形式: YYYY-MM-DD
      const time = slots.Time || undefined; // 期待される形式: HH:MM あるいは "10:00-11:00"

      console.log('[SearchAvailableDeliverySlotIntent] Handling with slots:', { date, time });

      // サービス呼び出し
      const available = DeliverySlotService.getAvailableSlots({ date, time, limit: 3 });

      if (!available || available.length === 0) {
        const speak = '申し訳ありません。指定された条件で利用可能な配送枠が見つかりませんでした。別の日付や時間を指定するか、条件を変更してください。';
        return handlerInput.responseBuilder.speak(speak).reprompt('別の日付や時間を指定しますか？').getResponse();
      }

      // セッションに候補を保存しておく（後でユーザーが番号選択することを想定）
      sessionAttributes.availableDeliverySlots = available;
      attributesManager.setSessionAttributes(sessionAttributes);

      // 読み上げ文を作成（最大3件）
      const listSpeech = available.map((s, i) => `番号${i + 1}、${s.spokenLabel}`).join('。 ');
      const speak = `利用可能な配送枠を提示します。${listSpeech}。どの枠を選びますか？ 番号で教えてください。`;
      const reprompt = 'どの配送枠を選びますか？ 番号で教えてください。';

      return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
    } catch (error) {
      console.error('[SearchAvailableDeliverySlotIntent] Error:', error);
      const speak = '申し訳ありません。配送枠の取得中にエラーが発生しました。もう一度お試しください。';
      return handlerInput.responseBuilder.speak(speak).reprompt('もう一度お試しください。').getResponse();
    }
  }
};

