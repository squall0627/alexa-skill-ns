// handlers/AddCartIntentHandler.js
// 日本語：AddCartIntent ハンドラ - ユーザーが番号で指定した商品をセッションのカートに追加する
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'AddCartIntent';
  },
  handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const sessionId = requestEnvelope.session ? requestEnvelope.session.sessionId : 'unknown';
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots || {};

    const attributesManager = handlerInput.attributesManager;
    let sessionAttributes = attributesManager.getSessionAttributes() || {};

    console.log(`[AddCartIntent] Handler started for session: ${sessionId}`);
    console.log(`[AddCartIntent] Current sessionAttributes keys:`, Object.keys(sessionAttributes));
    console.log(`[AddCartIntent] lastSearchResults available:`, !!sessionAttributes.lastSearchResults);

    // lastSearchResults に直近の検索結果（配列）を保持している想定
    const lastResults = sessionAttributes.lastSearchResults || [];

    // スロット名: ItemNumber
    const itemNumberSlot = slots.ItemNumber && (slots.ItemNumber.value || slots.ItemNumber.resolutions && slots.ItemNumber.resolutions.resolutionsPerAuthority && slots.ItemNumber.resolutions.resolutionsPerAuthority[0] && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values[0] && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values[0].value.name);

    const rawNumber = itemNumberSlot || (slots.ItemNumber && slots.ItemNumber.value);
    const index = rawNumber ? parseInt(rawNumber, 10) : NaN;

    console.log(`[AddCartIntent] Parsed ItemNumber slot: value=${rawNumber}, index=${index}`);

    // ユーザーフレンドリーな応答（日本語）
    if (!lastResults || lastResults.length === 0) {
      const speak = '現在カートに追加できる検索結果がありません。商品を検索して、表示された番号を教えてください。';
      console.log(`[AddCartIntent] No lastSearchResults available, returning error message`);
      return handlerInput.responseBuilder.speak(speak).reprompt('どの商品をお探しですか？').getResponse();
    }

    if (Number.isNaN(index) || index < 1 || index > lastResults.length) {
      const speak = `申し訳ありません。番号は1から${lastResults.length}の間で教えてください。もう一度番号を教えてください。`;
      console.log(`[AddCartIntent] Invalid index: ${index}, max: ${lastResults.length}`);
      return handlerInput.responseBuilder.speak(speak).reprompt(`1から${lastResults.length}の番号で教えてください。`).getResponse();
    }

    const product = lastResults[index - 1];
    console.log(`[AddCartIntent] Selected product:`, { id: product.id, name: product.name });

    // カートをセッション属性に保存
    const cart = sessionAttributes.cart || [];
    cart.push(product);
    sessionAttributes.cart = cart;
    sessionAttributes.lastAction = 'afterAdd';
    sessionAttributes.lastAdded = product;
    // マークを立ててインターセプターに保存させる
    sessionAttributes._cartDirty = true;

    // 一度だけ更新を保存
    attributesManager.setSessionAttributes(sessionAttributes);
    console.log(`[AddCartIntent] Session attributes updated:`, { cartSize: cart.length, lastAction: sessionAttributes.lastAction });

    // より自然な音声応答：商品名・ブランド・価格を読み上げ、次の選択肢を提示
    const shortInfo = `${product.name}、メーカー：${product.brand}、価格：${product.price}円`;
    const speak = `${shortInfo} をカートに追加しました。現在カートには ${cart.length} 件の商品があります。続けて別の商品を検索しますか？はいで続ける、いいえでカートを確認できます。`; 
    const reprompt = '続けて検索しますか？はいで続ける、いいえでカートを確認します。';

    return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
  }
};
