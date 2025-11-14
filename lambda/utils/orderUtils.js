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
  delete sessionAttributes.availablePromos;
  delete sessionAttributes.appliedPromo;
  delete sessionAttributes.lastAdded;
  // clear lastAction and any generic pending state
  delete sessionAttributes.lastAction;
  sessionAttributes._cartDirty = true;
  delete sessionAttributes.pending;
  delete sessionAttributes.pendingData;

  attributesManager.setSessionAttributes(sessionAttributes);
}

function clearCartSession(attributesManager) {
  const sessionAttributes = attributesManager.getSessionAttributes() || {};
  delete sessionAttributes.cart;
  delete sessionAttributes.cartDelivery;
  delete sessionAttributes.availablePromos;
  delete sessionAttributes.appliedPromo;
  delete sessionAttributes.lastAdded;
  // clear lastAction and generic pending
  delete sessionAttributes.lastAction;
  sessionAttributes._cartDirty = true;
  delete sessionAttributes.pending;
  delete sessionAttributes.pendingData;

  attributesManager.setSessionAttributes(sessionAttributes);
}

module.exports = {
  stopOrder,
  clearCartSession,
};
