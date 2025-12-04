// lambda/utils/orderUtils.js
// Shared utilities for clearing cart and stopping an order

async function stopOrder(attributesManager) {
  // Remove persistent order/cart data and clear order-related session attributes
  const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
  if (persistentAttributes.cartData) delete persistentAttributes.cartData;
  if (persistentAttributes.currentOrder) delete persistentAttributes.currentOrder;
  attributesManager.setPersistentAttributes(persistentAttributes);
  await attributesManager.savePersistentAttributes();

  const sessionAttributes = attributesManager.getSessionAttributes() || {};
  // clear session order-related fields
  console.log('[orderUtils] stopOrder clearing session attributes');
  delete sessionAttributes.cart;
  delete sessionAttributes.availableDeliverySlots;
  delete sessionAttributes.cartDelivery;
  delete sessionAttributes.availableDeliveryAddresses;
  delete sessionAttributes.cartDeliveryAddress;
  delete sessionAttributes.availablePromos;
  delete sessionAttributes.appliedPromo;
  delete sessionAttributes.lastAdded;
  // clear lastAction and any generic pending state
  delete sessionAttributes.lastAction;
  // 清理支付/结算相关的 session 字段
  delete sessionAttributes.paymentFlow; // { method, useWaon, waonPoints, useShareholderCard, status }
  delete sessionAttributes.lastPaymentResult; // 最后一次支付结果
  sessionAttributes._cartDirty = true;
  delete sessionAttributes.pending;
  delete sessionAttributes.pendingData;

  attributesManager.setSessionAttributes(sessionAttributes);
  // 会話履歴も削除する
  try {
    const ConversationHistoryService = require('../services/ConversationHistoryService');
    await ConversationHistoryService.clearHistory(attributesManager);
  } catch (e) {
    console.log('[orderUtils] Failed to clear conversation history:', e);
  }
}

function clearCartSession(attributesManager) {
  const sessionAttributes = attributesManager.getSessionAttributes() || {};
  console.log('[orderUtils] clearCartSession before:', JSON.stringify(sessionAttributes));
  delete sessionAttributes.cart;
  delete sessionAttributes.availableDeliverySlots;
  delete sessionAttributes.availableDeliveryAddresses;
  delete sessionAttributes.availablePromos;
  delete sessionAttributes.appliedPromo;
  delete sessionAttributes.lastAdded;
  // 清理支付相关会话数据（カートだけをクリアするときにも残っていると問題になることがある）
  delete sessionAttributes.paymentFlow;
  delete sessionAttributes.lastPaymentResult;
  // clear lastAction and generic pending
  delete sessionAttributes.lastAction;
  sessionAttributes._cartDirty = true;
  delete sessionAttributes.pending;
  delete sessionAttributes.pendingData;
  console.log('[orderUtils] clearCartSession after:', JSON.stringify(sessionAttributes));

  attributesManager.setSessionAttributes(sessionAttributes);
}

/**
 * 注文確定後の共通後処理
 * 支払い成功時に呼び出して、関連するセッション・永続化データをクリアする
 */
async function finalizeOrderSuccess(attributesManager) {
  // 将来ここで orderHistory への追記やレシート保存などを行った後、セッションをクリア
  await stopOrder(attributesManager);
}

module.exports = {
  stopOrder,
  clearCartSession,
  finalizeOrderSuccess,
};
