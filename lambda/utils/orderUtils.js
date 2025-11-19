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
  sessionAttributes._cartDirty = true;
  delete sessionAttributes.pending;
  delete sessionAttributes.pendingData;

  attributesManager.setSessionAttributes(sessionAttributes);
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
  // clear lastAction and generic pending
  delete sessionAttributes.lastAction;
  sessionAttributes._cartDirty = true;
  delete sessionAttributes.pending;
  delete sessionAttributes.pendingData;
  console.log('[orderUtils] clearCartSession after:', JSON.stringify(sessionAttributes));

  attributesManager.setSessionAttributes(sessionAttributes);
}

module.exports = {
  stopOrder,
  clearCartSession,
};
