// filepath: /Users/squall/develop/Alexa-skill-ns/lambda/utils/CartPersistenceHelper.js
// CartPersistenceHelper.js
// 统一处理 cartData 的构建与判断是否需要持久化（脏标记）

function buildCartData(sessionAttributes) {
  // 只收集需要持久化的字段
  const data = {};
  if (Array.isArray(sessionAttributes.cart) && sessionAttributes.cart.length > 0) {
    data.cart = sessionAttributes.cart;
  } else {
    data.cart = [];
  }
  if (sessionAttributes.cartDelivery) {
    data.cartDelivery = sessionAttributes.cartDelivery;
  }
  // 你可以在这里加入更多需要持久化的 cart 元数据
  return data;
}

function deepEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
}

function shouldSave(sessionAttributes, persistentCartData) {
  // 如果显式脏标记，则必须保存
  if (sessionAttributes._cartDirty) return true;

  // 如果持久化中没有 cartData，则需要保存
  if (!persistentCartData) return true;

  // 如果 session 中的 cart/cartDelivery 与持久化的不同，则保存
  const newData = buildCartData(sessionAttributes);
  return !deepEqual(newData, persistentCartData);
}

module.exports = {
  buildCartData,
  shouldSave
};

