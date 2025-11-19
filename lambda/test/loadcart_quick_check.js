const { LoadCartInterceptor } = require('../index');

function mockAttributesManager(initialPersistent = {}, initialSession = {}) {
  let persistent = { ...initialPersistent };
  let session = { ...initialSession };
  return {
    getSessionAttributes: () => session,
    setSessionAttributes: (s) => { session = s; },
    getPersistentAttributes: async () => persistent,
    setPersistentAttributes: (p) => { persistent = p; },
    savePersistentAttributes: async () => {},
    _getState: () => ({ persistent, session })
  };
}

async function run() {
  const cartData = {
    cart: [{ id: 'p1', quantity: 2 }],
    cartDelivery: { id: 'slot1' },
    cartDeliveryAddress: { id: 'addr1' },
    appliedPromo: { id: 'PROMO1', name: '割引' },
    paymentFlow: { method: 'credit', useWaon: true, waonPoints: 50, useShareholderCard: false }
  };

  const attributesManager = mockAttributesManager({ cartData }, {
    // session has different values that should be overwritten under strategy B
    cart: [{ id: 'p-old' }],
    cartDelivery: { id: 'slot-old' },
    cartDeliveryAddress: { id: 'addr-old' },
    appliedPromo: { id: 'PROMO-OLD' },
    paymentFlow: { method: 'cash', useWaon: false }
  });

  const handlerInput = { attributesManager };
  await LoadCartInterceptor.process(handlerInput);

  const sa = attributesManager.getSessionAttributes();
  console.log('session after load:', JSON.stringify(sa, null, 2));

  if (JSON.stringify(sa.cart) !== JSON.stringify(cartData.cart)) throw new Error('cart not overwritten');
  if (sa.cartDelivery.id !== cartData.cartDelivery.id) throw new Error('cartDelivery not overwritten');
  if (sa.cartDeliveryAddress.id !== cartData.cartDeliveryAddress.id) throw new Error('cartDeliveryAddress not overwritten');
  if (sa.appliedPromo.id !== cartData.appliedPromo.id) throw new Error('appliedPromo not overwritten');
  if (sa.paymentFlow.method !== cartData.paymentFlow.method) throw new Error('paymentFlow not overwritten');

  console.log('LoadCartInterceptor strategy B quick check PASSED');
}

run().catch(err => { console.error('LoadCartInterceptor quick check FAILED:', err); process.exit(1); });

