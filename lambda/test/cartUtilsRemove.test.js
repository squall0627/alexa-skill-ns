const cartUtils = require('../utils/cartUtils');

describe('cartUtils.removeOrReduceCartItem', () => {
  test('remove entire item when quantity is null', () => {
    const cart = [{ id: 1, name: 'りんご', quantity: 3 }];
    const { cart: newCart, removedItem, remainingQuantity, removedCompletely } = cartUtils.removeOrReduceCartItem(cart, 1, null);
    expect(removedCompletely).toBe(true);
    expect(removedItem.id).toBe(1);
    expect(newCart.length).toBe(0);
    expect(remainingQuantity).toBe(0);
  });

  test('reduce quantity when quantity less than current', () => {
    const cart = [{ id: 2, name: 'みかん', quantity: 5 }];
    const { cart: newCart, removedItem, remainingQuantity, removedCompletely } = cartUtils.removeOrReduceCartItem(cart, 2, 2);
    expect(removedCompletely).toBe(false);
    expect(removedItem.removed).toBe(2);
    expect(remainingQuantity).toBe(3);
    expect(newCart[0].quantity).toBe(3);
  });

  test('remove entire item when quantity >= current', () => {
    const cart = [{ id: 3, name: 'バナナ', quantity: 2 }];
    const { cart: newCart, removedCompletely } = cartUtils.removeOrReduceCartItem(cart, 3, 5);
    expect(removedCompletely).toBe(true);
    expect(newCart.length).toBe(0);
  });
});

