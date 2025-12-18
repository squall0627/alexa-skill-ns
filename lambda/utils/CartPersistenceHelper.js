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
  if (sessionAttributes.cartDeliveryAddress) {
    data.cartDeliveryAddress = sessionAttributes.cartDeliveryAddress;
  }

  // Persist applied promotion / coupon info when present
  if (sessionAttributes.appliedPromo) {
    // store only the minimal promo snapshot (id/name/discount) to avoid sending large objects
    const p = sessionAttributes.appliedPromo;
    data.appliedPromo = {
      id: p.id || p.promoId || null,
      name: p.name || p.label || null,
      // keep any numeric discount or percent if available
      amount: (typeof p.amount === 'number') ? p.amount : null,
      percent: (typeof p.percent === 'number') ? p.percent : null
    };
  }

  // Persist payment-related decisions: method, WAON usage and points, shareholder card usage
  if (sessionAttributes.paymentFlow) {
    const pf = sessionAttributes.paymentFlow || {};
    data.paymentFlow = {
      method: pf.method || null,
      // whether WAON was chosen to be used
      useWaon: (pf.useWaon === true) || (pf.useWaon === false) ? pf.useWaon : null,
      // points user decided to use
      waonPoints: (typeof pf.waonPoints === 'number') ? pf.waonPoints : (pf.waonPoints ? Number(pf.waonPoints) : null),
      // shareholder / owners card usage flag
      useShareholderCard: (pf.useShareholderCard === true) || (pf.useShareholderCard === false) ? pf.useShareholderCard : null
    };
  }

  // 你可以在这里加入更多需要持久化的 cart 元数据
  return data;
}

function deepEqual(a, b) {
  // Treat undefined and null as equivalent
  function eq(x, y) {
    // normalize undefined to null
    if (x === undefined) x = null;
    if (y === undefined) y = null;

    // both null
    if (x === null && y === null) return true;

    // arrays
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) return false;
      for (let i = 0; i < x.length; i++) {
        if (!eq(x[i], y[i])) return false;
      }
      return true;
    }

    // one is array, other not
    if (Array.isArray(x) || Array.isArray(y)) return false;

    // objects
    if (typeof x === 'object' && typeof y === 'object') {
      // union of keys
      const keys = new Set([...(Object.keys(x || {})), ...(Object.keys(y || {}))]);
      for (const k of keys) {
        const vx = Object.prototype.hasOwnProperty.call(x || {}, k) ? x[k] : undefined;
        const vy = Object.prototype.hasOwnProperty.call(y || {}, k) ? y[k] : undefined;
        if (!eq(vx, vy)) return false;
      }
      return true;
    }

    // primitives (number, string, boolean)
    return x === y;
  }

  try {
    return eq(a, b);
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
