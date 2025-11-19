const CartPersistenceHelper = require('../utils/CartPersistenceHelper');

describe('CartPersistenceHelper', () => {
  test('buildCartData returns empty cart when none', () => {
    const sessionAttrs = {};
    const data = CartPersistenceHelper.buildCartData(sessionAttrs);
    expect(data).toHaveProperty('cart');
    expect(Array.isArray(data.cart)).toBe(true);
    expect(data.cart.length).toBe(0);
  });

  test('buildCartData includes cartDelivery when present', () => {
    const sessionAttrs = { cart: [{ id: 1 }], cartDelivery: { id: '2025-11-14_10:00-11:00' } };
    const data = CartPersistenceHelper.buildCartData(sessionAttrs);
    expect(data.cart.length).toBe(1);
    expect(data.cartDelivery).toEqual(sessionAttrs.cartDelivery);
  });

  test('shouldSave true when no persistentCartData', () => {
    const sessionAttrs = { cart: [{ id: 1 }] };
    expect(CartPersistenceHelper.shouldSave(sessionAttrs, null)).toBe(true);
  });

  test('shouldSave true when dirty flag set', () => {
    const sessionAttrs = { cart: [{ id: 1 }], _cartDirty: true };
    expect(CartPersistenceHelper.shouldSave(sessionAttrs, { cart: [] })).toBe(true);
  });

  test('shouldSave false when equal', () => {
    const sessionAttrs = { cart: [{ id: 1 }], cartDelivery: { id: 'slot' } };
    const persistent = { cart: [{ id: 1 }], cartDelivery: { id: 'slot' } };
    expect(CartPersistenceHelper.shouldSave(sessionAttrs, persistent)).toBe(false);
  });

  test('should treat null and undefined as equal for simple fields', () => {
    const sessionAttrs = { cart: [{ id: 1 }], paymentFlow: { method: undefined } };
    const persistent = { cart: [{ id: 1 }], paymentFlow: { method: null } };
    expect(CartPersistenceHelper.shouldSave(sessionAttrs, persistent)).toBe(false);
  });

  test('should treat missing nested numeric field undefined equal to null', () => {
    const sessionAttrs = { cart: [{ id: 1 }], paymentFlow: { /* waonPoints missing */ } };
    const persistent = { cart: [{ id: 1 }], paymentFlow: { waonPoints: null } };
    expect(CartPersistenceHelper.shouldSave(sessionAttrs, persistent)).toBe(false);
  });
});
