const cartUtils = require('../utils/cartUtils');

describe('cartUtils.addOrMergeCartItem', () => {
  test('adds new item when not exist', () => {
    const cart = [];
    const product = { id: 1, name: 'りんご' };
    const { cart: newCart, item, totalQuantity } = cartUtils.addOrMergeCartItem(cart, product, 2);
    expect(newCart.length).toBe(1);
    expect(item.id).toBe(1);
    expect(totalQuantity).toBe(2);
  });

  test('merges quantity when item exists', () => {
    const cart = [{ id: 1, name: 'りんご', quantity: 3 }];
    const product = { id: 1, name: 'りんご' };
    const { cart: newCart, item, totalQuantity } = cartUtils.addOrMergeCartItem(cart, product, 2);
    expect(newCart.length).toBe(1);
    expect(item.quantity).toBe(5);
    expect(totalQuantity).toBe(5);
  });
});

