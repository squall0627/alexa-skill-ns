// services/cartService.js
// 日本語：カート関連の金額計算/適用を扱うサービス

/**
 * カート合計金額を計算
 */
function cartTotal(cart) {
  return cart.reduce((sum, it) => sum + it.price * it.qty, 0);
}

/**
 * クーポン適用（簡易ロジック）
 */
function applyCoupons(total, coupons, cart) {
  let discounted = total;
  for (const c of coupons || []) {
    if (c.discountPct && cart.some(it => it.category === (c.category || ''))) {
      discounted = Math.round(discounted * (100 - c.discountPct) / 100);
    }
    if (c.discountYen && total >= (c.minTotal || 0)) {
      discounted = Math.max(0, discounted - c.discountYen);
    }
  }
  return discounted;
}

module.exports = { cartTotal, applyCoupons };
