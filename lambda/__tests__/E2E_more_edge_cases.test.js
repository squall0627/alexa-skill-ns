const SearchAvailablePromotionIntentHandler = require('../handlers/SearchAvailablePromotionIntentHandler');
const SelectDeliverySlotIntentHandler = require('../handlers/SelectDeliverySlotIntentHandler');
const SelectDeliveryAddressIntentHandler = require('../handlers/SelectDeliveryAddressIntentHandler');
const PendingConfirmationHandler = require('../handlers/PendingConfirmationHandler');

// We'll mock services as needed per-test

function makeHandlerInput({ intentName = 'Intent', slots = {}, sessionAttrs = {} } = {}) {
  const requestEnvelope = {
    request: {
      type: 'IntentRequest',
      intent: { name: intentName, slots }
    },
    session: { sessionId: 'session123' },
  };

  const attributesManager = {
    _session: { ...sessionAttrs },
    getSessionAttributes() { return this._session; },
    setSessionAttributes(attrs) { this._session = attrs; },
    // persistence stubs used by some handlers (orderUtils, interceptors)
    async getPersistentAttributes() { return {}; },
    async setPersistentAttributes() { return {}; },
    async savePersistentAttributes() { return {}; },
  };

  const built = {};
  const responseBuilder = {
    speak(text) { built.speak = text; return this; },
    reprompt(text) { built.reprompt = text; return this; },
    getResponse() { return built; }
  };

  return { requestEnvelope, attributesManager, responseBuilder };
}

describe('E2E more edge cases', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('SearchAvailablePromotion: threshold not met informs how much more to buy', async () => {
    // mock CheckoutService to return no availablePromos but TableHandler to return promos with thresholds
    jest.mock('../services/CheckoutService', () => ({
      calculate: jest.fn(async (cart, deliveryFee) => ({ itemsTotal: 500, subtotal: 500, availablePromos: [] }))
    }));

    // mock TableHandler to return promos with higher thresholds
    jest.mock('../tables/TableHandler', () => {
      return jest.fn().mockImplementation(() => ({
        readAll: async () => [
          { id: 'p1', name: 'promoA', orderThreshold: 1000, discountAmount: 100 },
          { id: 'p2', name: 'promoB', orderThreshold: 800, discountAmount: 50 }
        ]
      }));
    });

    // re-require handler under test
    const Handler = require('../handlers/SearchAvailablePromotionIntentHandler');

    const session = { cart: [{ id: 'p1', price: 500 }], cartDelivery: { fee: 0 } };
    const hi = makeHandlerInput({ intentName: 'SearchAvailablePromotionIntent', sessionAttrs: session });
    expect(Handler.canHandle(hi)).toBe(true);
    const res = await Handler.handle(hi);
    expect(res.speak).toMatch(/あと/); // should mention how much more
  });

  test('SelectDeliverySlot: invalid slot index prompts error', async () => {
    const Handler = require('../handlers/SelectDeliverySlotIntentHandler');
    const session = { availableDeliverySlots: [{ id: 's1', spokenLabel: '午前' }] , lastAction: 'SearchAvailableDeliverySlotIntent' };
    const hi = makeHandlerInput({ intentName: 'SelectDeliverySlotIntent', slots: { SlotNumber: { value: '2' } }, sessionAttrs: session });
    expect(Handler.canHandle(hi)).toBe(true);
    const res = await Handler.handle(hi);
    expect(res.speak).toMatch(/番号は1から1の間/); // phrasing from handler
  });

  test('PendingConfirmationHandler confirmDefaultAddress: service returns null -> apologizes', async () => {
    // mock DeliveryAddressService.getAddressByIndex to return null
    jest.mock('../services/DeliveryAddressService', () => ({
      getAddressByIndex: jest.fn(async () => null)
    }));

    const Handler = require('../handlers/PendingConfirmationHandler');
    // set session as if pending confirmDefaultAddress
    const session = { pending: true, pendingData: { kind: 'confirmDefaultAddress', addressIndex: 1 }, lastAction: 'SearchAvailableDeliveryAddressIntent' };
    const hi = makeHandlerInput({ intentName: 'AMAZON.YesIntent', sessionAttrs: session });
    expect(Handler.canHandle(hi)).toBe(true);
    const res = await Handler.handle(hi);
    expect(res.speak).toMatch(/申し訳ありません。届け先を設定できませんでした。/);
  });

  test('Payment finalize success path clears and thanks user', async () => {
    // mock PaymentService.createPayment to return success true
    jest.mock('../services/PaymentService', () => ({
      createPayment: jest.fn(async () => ({ success: true, totalAfterPoints: 90, rewardPoints: 2 }))
    }));

    const Handler = require('../handlers/PendingConfirmationHandler');
    const session = { pending: true, pendingData: { kind: 'confirmFinalizePayment' } };
    const hi = makeHandlerInput({ intentName: 'AMAZON.YesIntent', sessionAttrs: session });
    expect(Handler.canHandle(hi)).toBe(true);
    const res = await Handler.handle(hi);
    expect(res.speak).toMatch(/ご注文とお支払いを確定しました/);
  });
});
