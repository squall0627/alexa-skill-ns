// handlers/SearchProductIntentHandler.js
// 日本語：商品検索 Intent（SearchProductIntent）専用ハンドラ。
const Alexa = require('ask-sdk-core');
const SearchProductService = require('../services/SearchProductService');

module.exports = {
  canHandle(handlerInput) {
    // 日本語：IntentRequest かつ SearchProductIntent のみ処理
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'SearchProductIntent';
  },
  async handle(handlerInput) {
    // 日本語：スロットとセッション属性を収集してサービスに委譲
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots ? Object.fromEntries(Object.entries(intent.slots).map(([k, v]) => [k, v && v.value])) : {};

    const sessionId = requestEnvelope.session ? requestEnvelope.session.sessionId : 'unknown';
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    try {
      // ログ: ハンドラ開始、セッションと slot の中身を出力
      console.log('SearchProductIntent invoked', {
        sessionId,
        locale: requestEnvelope.request.locale,
        slots,
        sessionAttributesPreview: Object.keys(sessionAttributes).length
      });

      // 日本語：スロット値の整理
      const searchFilters = {
        productQuery: slots.ProductQuery || undefined,
        brand: slots.Brand || undefined,
        category: slots.Category || undefined,
        limit: 3,
        offset: sessionAttributes.currentPage ? (sessionAttributes.currentPage - 1) * 3 : 0,
      };

      console.log('SearchProductIntent search filters:', JSON.stringify(searchFilters, null, 2));

      // 日本語：SearchProductService を呼び出してサービス側の検索ロジックを実行
      const serviceResp = await SearchProductService.search(searchFilters);

      // ログ: サービス レスポンス要約
      console.log('SearchProductIntent service response:', JSON.stringify({
        spokenResponse: serviceResp.spokenResponse,
        reprompt: serviceResp.reprompt,
        shouldEndSession: serviceResp.shouldEndSession,
        productsCount: serviceResp.products ? serviceResp.products.length : 0,
        paginationInfo: serviceResp.pagination,
        sessionAttributesKeys: serviceResp.sessionAttributes ? Object.keys(serviceResp.sessionAttributes) : []
      }, null, 2));

      // 日本語：セッション属性を更新
      if (serviceResp.sessionAttributes && typeof serviceResp.sessionAttributes === 'object') {
        // 既存のカート情報を保持しつつ、新しい検索結果を追加
        const newAttrs = {
          ...sessionAttributes, // 既存の sessionAttributes を保持（cart など）
          ...serviceResp.sessionAttributes // サービスからの新しい属性で上書き
        };
        attributesManager.setSessionAttributes(newAttrs);
        console.log(`[SearchProductIntent] Session attributes updated:`, {
          sessionId: sessionId,
          cartSize: newAttrs.cart ? newAttrs.cart.length : 0,
          lastSearchQuery: newAttrs.lastSearchQuery,
          lastSearchResultsCount: newAttrs.lastSearchResults ? newAttrs.lastSearchResults.length : 0
        });
      }

      const speech = serviceResp.spokenResponse || '該当商品が見つかりませんでした。何を検索しますか？';
      const reprompt = serviceResp.reprompt || '続けますか？';
      const shouldEnd = serviceResp.shouldEndSession === true;

      const builder = handlerInput.responseBuilder.speak(speech);
      if (!shouldEnd) builder.reprompt(reprompt); else builder.withShouldEndSession(true);
      return builder.getResponse();
    } catch (e) {
      console.error('SearchProductIntent service error:', e);
      const spokenResponse = '申し訳ありません。現在リクエストを処理できません。少し時間をおいてもう一度お試しください。';
      const reprompt = '恐れ入りますが、もう一度お願いします。';
      return handlerInput.responseBuilder.speak(spokenResponse).reprompt(reprompt).getResponse();
    }
  }
};
