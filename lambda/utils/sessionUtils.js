// セッションユーティリティ（sessionUtils）
// セッション属性操作のための小さなユーティリティ

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
