// A lightweight runner to allow running tests without installing jest,
// by executing the modules' basic functions and printing results.
const DeliverySlotService = require('../services/DeliverySlotService');
const CartPersistenceHelper = require('../utils/CartPersistenceHelper');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

console.log('Running light tests...');

// DeliverySlotService basic
const slots = DeliverySlotService.getAvailableSlots({});
console.log('slots length:', slots.length);
assert(Array.isArray(slots), 'slots should be array');

// parse 今日
const todaySlots = DeliverySlotService.getAvailableSlots({ date: '今日' });
console.log('todaySlots length:', todaySlots.length);
assert(todaySlots.every(s => typeof s.dateISO === 'string'), 'todaySlots must have dateISO');

// CartPersistenceHelper
const cd = CartPersistenceHelper.buildCartData({ cart: [{ id: 1 }], cartDelivery: { id: 'slot' } });
console.log('cartData:', cd);
assert(cd.cart && cd.cart.length === 1, 'cart length must be 1');

console.log('Light tests passed');

// Run NumberOnlyIntentHandler tests
try {
  const runNumberOnlyTests = require('./NumberOnlyIntentHandler.test.js');
  runNumberOnlyTests();
} catch (err) {
  console.error('NumberOnlyIntentHandler tests failed:', err);
  process.exit(1);
}
