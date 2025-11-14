// lambda/utils/cartUtils.js
// カートユーティリティ: 同一商品を合併して数量を累積する処理を抽出

function addOrMergeCartItem(cart, product, quantity) {
  if (!Array.isArray(cart)) cart = [];
  const idx = cart.findIndex((ci) => ci && ci.id === product.id);
  if (idx !== -1) {
    cart[idx].quantity = (cart[idx].quantity || 1) + quantity;
    return { cart, item: cart[idx], totalQuantity: cart[idx].quantity };
  }

  const cartItem = { ...product, quantity };
  cart.push(cartItem);
  return { cart, item: cartItem, totalQuantity: cartItem.quantity };
}

// 删除或减少指定商品的数量。如果 quantity 为 null 则表示删除整项
// 返回 { cart, removedItem, remainingQuantity, removedCompletely }
function removeOrReduceCartItem(cart, productId, quantity) {
  if (!Array.isArray(cart)) cart = [];
  const idx = cart.findIndex((ci) => ci && ci.id === productId);
  if (idx === -1) return { cart, removedItem: null, remainingQuantity: 0, removedCompletely: false };

  const existing = cart[idx];
  const currentQty = existing.quantity || 1;

  if (quantity == null) {
    // 删除整项
    cart.splice(idx, 1);
    return { cart, removedItem: existing, remainingQuantity: 0, removedCompletely: true };
  }

  // 当指定数量大于等于当前数量，则删除整项
  if (quantity >= currentQty) {
    cart.splice(idx, 1);
    return { cart, removedItem: existing, remainingQuantity: 0, removedCompletely: true };
  }

  // 否则减少数量
  cart[idx].quantity = currentQty - quantity;
  return { cart, removedItem: { ...existing, removed: quantity }, remainingQuantity: cart[idx].quantity, removedCompletely: false };
}

module.exports = {
  addOrMergeCartItem,
  removeOrReduceCartItem,
};
