// lambda/utils/sessionUtils.js
// Small helper utilities for session attribute manipulation

function markLastAction(handlerInput, name) {
  if (!handlerInput || !handlerInput.attributesManager) return;
  const attributesManager = handlerInput.attributesManager;
  const sessionAttributes = attributesManager.getSessionAttributes() || {};
  sessionAttributes.lastAction = name;
  attributesManager.setSessionAttributes(sessionAttributes);
}

module.exports = {
  markLastAction,
};

