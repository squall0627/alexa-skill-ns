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
  delete sessionAttributes.cart;
  delete sessionAttributes.cartDelivery;
  delete sessionAttributes.pendingAdd;
  delete sessionAttributes.pendingDelete;
  delete sessionAttributes.availablePromos;
  delete sessionAttributes.appliedPromo;
  delete sessionAttributes.lastAdded;
  delete sessionAttributes.lastAction;
  delete sessionAttributes._cartDirty;
  // also clear pendingStopOrder/pendingClearCart if present
  delete sessionAttributes.pendingStopOrder;
  delete sessionAttributes.pendingClearCart;

  attributesManager.setSessionAttributes(sessionAttributes);
}

function clearCartSession(attributesManager) {
  const sessionAttributes = attributesManager.getSessionAttributes() || {};
  delete sessionAttributes.cart;
  delete sessionAttributes.cartDelivery;
  delete sessionAttributes.pendingAdd;
  delete sessionAttributes.pendingDelete;
  delete sessionAttributes.availablePromos;
  delete sessionAttributes.appliedPromo;
  delete sessionAttributes.lastAdded;
  delete sessionAttributes.lastAction;
  sessionAttributes._cartDirty = true;
  // clear pending flag
  delete sessionAttributes.pendingClearCart;

  attributesManager.setSessionAttributes(sessionAttributes);
}

module.exports = {
  stopOrder,
  clearCartSession,
};

