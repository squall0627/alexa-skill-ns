const SearchProductIntentHandler = require('../handlers/SearchProductIntentHandler');
const AddCartIntentHandler = require('../handlers/AddCartIntentHandler');
const SearchAvailableDeliverySlotIntentHandler = require('../handlers/SearchAvailableDeliverySlotIntentHandler');
const SelectDeliverySlotIntentHandler = require('../handlers/SelectDeliverySlotIntentHandler');
const SearchAvailableDeliveryAddressIntentHandler = require('../handlers/SearchAvailableDeliveryAddressIntentHandler');
const SelectDeliveryAddressIntentHandler = require('../handlers/SelectDeliveryAddressIntentHandler');
const PendingConfirmationHandler = require('../handlers/PendingConfirmationHandler');
const SearchAvailablePromotionIntentHandler = require('../handlers/SearchAvailablePromotionIntentHandler');
const SelectPromotionIntentHandler = require('../handlers/SelectPromotionIntentHandler');
const StartPaymentIntentHandler = require('../handlers/StartPaymentIntentHandler');

// Mock services used across handlers
jest.mock('../services/SearchProductService', () => ({
  search: jest.fn(async (filters) => ({
    spokenResponse: 'りんごが見つかりました。1番はりんごです。',
    reprompt: 'どの番号を追加しますか？',
    shouldEndSession: false,
    sessionAttributes: { lastSearchResults: [{ id: 'p1', name: 'りんご', brand: '農園', price: 100 }] }
  }))
}));

jest.mock('../services/DeliverySlotService', () => ({
  getAvailableSlots: jest.fn(() => [
    { id: 's1', spokenLabel: '明日の午前', fee: 0 },
    { id: 's2', spokenLabel: '明日の午後', fee: 0 }
  ])
}));

jest.mock('../services/DeliveryAddressService', () => ({
  listAddresses: jest.fn(async () => [
    { id: 'a1', spokenLabel: '自宅' },
    { id: 'a2', spokenLabel: '職場' }
  ]),
  getAddressByIndex: jest.fn(async (attributesManager, idx) => {
    const list = [{ id: 'a1', spokenLabel: '自宅' }, { id: 'a2', spokenLabel: '職場' }];
    return list[idx - 1] || null;
  })
}));

jest.mock('../services/CheckoutService', () => ({
  calculate: jest.fn(async (cart, deliveryFee) => ({
    itemsTotal: 100,
    subtotal: 100,
    availablePromos: [{ id: 'promo1', name: '10円引き', discountAmount: 10, orderThreshold: 0 }]
  })),
  finalize: jest.fn(async (cart, deliveryFee, promo) => ({ summary: '合計90円' }))
}));

jest.mock('../services/PaymentService', () => ({
  getPaymentMethods: jest.fn(() => [{ label: 'クレジットカード' }, { label: '代金引換' }]),
  getWaonBalance: jest.fn(async () => 500),
  createPayment: jest.fn(async () => ({ success: true, totalAfterPoints: 90, rewardPoints: 1 }))
}));

function makeHandlerInput({ intentName = 'Intent', slots = {}, sessionAttrs = {} } = {}) {
  const requestEnvelope = {
    request: {
      type: 'IntentRequest',
      intent: { name: intentName, slots }
    },
    session: { sessionId: 'session123' },
    context: {}
  };

  const attributesManager = {
    _session: { ...sessionAttrs },
    getSessionAttributes() { return this._session; },
    setSessionAttributes(attrs) { this._session = attrs; },
    async getPersistentAttributes() { return {}; },
    async setPersistentAttributes() { },
    async savePersistentAttributes() {}
  };

  const built = {};
  const responseBuilder = {
    speak(text) { built.speak = text; return this; },
    reprompt(text) { built.reprompt = text; return this; },
    getResponse() { return built; }
  };

  return { requestEnvelope, attributesManager, responseBuilder };
}

describe('E2E purchase flow', () => {
  test('search -> add -> select slot -> select address -> check promos -> apply promo -> proceed to payment', async () => {
    // 1) Search products
    const hiSearch = makeHandlerInput({ intentName: 'SearchProductIntent', slots: { ProductQuery: { value: 'りんご' } }, sessionAttrs: {} });
    expect(SearchProductIntentHandler.canHandle(hiSearch)).toBe(true);
    const resSearch = await SearchProductIntentHandler.handle(hiSearch);
    expect(resSearch.speak).toContain('りんごが見つかりました');
    const session1 = hiSearch.attributesManager.getSessionAttributes();
    expect(session1.lastSearchResults).toBeDefined();

    // 2) Add to cart (user says '1' with quantity 2)
    const hiAdd = makeHandlerInput({ intentName: 'AddCartIntent', slots: { ItemNumber: { value: '1' }, Quantity: { value: '2' } }, sessionAttrs: { lastSearchResults: session1.lastSearchResults, lastAction: 'SearchProductIntent' } });
    expect(AddCartIntentHandler.canHandle(hiAdd)).toBe(true);
    const resAdd = await AddCartIntentHandler.handle(hiAdd);
    expect(resAdd.speak).toContain('追加しました');
    const session2 = hiAdd.attributesManager.getSessionAttributes();
    expect(Array.isArray(session2.cart)).toBe(true);
    expect(session2.cart.length).toBe(1);

    // 3) Search available delivery slots
    const hiSlots = makeHandlerInput({ intentName: 'SearchAvailableDeliverySlotIntent', sessionAttrs: { cart: session2.cart } });
    expect(SearchAvailableDeliverySlotIntentHandler.canHandle(hiSlots)).toBe(true);
    const resSlots = await SearchAvailableDeliverySlotIntentHandler.handle(hiSlots);
    expect(resSlots.speak).toContain('利用可能な配送枠を提示します');
    const session3 = hiSlots.attributesManager.getSessionAttributes();
    expect(session3.availableDeliverySlots).toBeDefined();

    // 4) Select delivery slot (no address yet) -> should delegate to SearchAvailableDeliveryAddressIntentHandler and set availableDeliveryAddresses
    const hiSelectSlot = makeHandlerInput({ intentName: 'SelectDeliverySlotIntent', slots: { SlotNumber: { value: '1' } }, sessionAttrs: { availableDeliverySlots: session3.availableDeliverySlots, cart: session3.cart, lastAction: 'SearchAvailableDeliverySlotIntent' } });
    expect(SelectDeliverySlotIntentHandler.canHandle(hiSelectSlot)).toBe(true);
    const resSelectSlot = await SelectDeliverySlotIntentHandler.handle(hiSelectSlot);
    // Since no address, handler delegates to SearchAvailableDeliveryAddressIntentHandler which prompts addresses
    expect(resSelectSlot.speak).toContain('届け先を選択してください');
    const session4 = hiSelectSlot.attributesManager.getSessionAttributes();
    expect(session4.availableDeliveryAddresses).toBeDefined();

    // 5) Select delivery address (choose 1)
    const hiSelectAddr = makeHandlerInput({ intentName: 'SelectDeliveryAddressIntent', slots: { AddressNumber: { value: '1' } }, sessionAttrs: { availableDeliveryAddresses: session4.availableDeliveryAddresses, lastAction: 'SearchAvailableDeliveryAddressIntent', cart: session2.cart } });
    expect(SelectDeliveryAddressIntentHandler.canHandle(hiSelectAddr)).toBe(true);
    const resSelectAddr = await SelectDeliveryAddressIntentHandler.handle(hiSelectAddr);
    expect(resSelectAddr.speak).toContain('利用可能なクーポンを確認しますか');
    const session5 = hiSelectAddr.attributesManager.getSessionAttributes();
    expect(session5.pending).toBe(true);
    expect(session5.pendingData && session5.pendingData.kind).toBe('confirmCheckPromotions');

    // 6) Simulate promotion search (PendingConfirmationHandler would delegate to SearchAvailablePromotionIntentHandler)
    session5.cart = session2.cart; // ensure cart present
    const hiSearchPromos = makeHandlerInput({ intentName: 'SearchAvailablePromotionIntent', sessionAttrs: session5 });
    expect(SearchAvailablePromotionIntentHandler.canHandle(hiSearchPromos)).toBe(true);
    const resSearchPromos = await SearchAvailablePromotionIntentHandler.handle(hiSearchPromos);
    expect(resSearchPromos.speak).toContain('利用可能なクーポンがあります');
    const session6 = hiSearchPromos.attributesManager.getSessionAttributes();
    expect(session6.availablePromos).toBeDefined();

    // 7) Select promotion (choose 1)
    const hiSelectPromo = makeHandlerInput({ intentName: 'SelectPromotionIntent', slots: { PromoNumber: { value: '1' } }, sessionAttrs: { availablePromos: session6.availablePromos, cart: session2.cart, lastAction: 'SearchAvailablePromotionIntent' } });
    expect(SelectPromotionIntentHandler.canHandle(hiSelectPromo)).toBe(true);
    const resSelectPromo = await SelectPromotionIntentHandler.handle(hiSelectPromo);
    expect(resSelectPromo.speak).toContain('お支払いに進みますか');
    const session7 = hiSelectPromo.attributesManager.getSessionAttributes();
    expect(session7.pending).toBe(true);
    expect(session7.pendingData && session7.pendingData.kind).toBe('confirmProceedToPayment');

    // 8) PendingConfirmationHandler: user says Yes to proceed to payment -> should delegate to StartPaymentIntentHandler
    const hiYesPay = makeHandlerInput({ intentName: 'AMAZON.YesIntent', sessionAttrs: { pending: true, pendingData: { kind: 'confirmProceedToPayment' }, lastAction: 'SelectPromotionIntent' } });
    expect(PendingConfirmationHandler.canHandle(hiYesPay)).toBe(true);
    const resYesPay = await PendingConfirmationHandler.handle(hiYesPay);
    expect(resYesPay.speak).toContain('お支払い方法を選択してください');

  }, 10000);
});
