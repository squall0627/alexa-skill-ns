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

// Reuse and extend mocks from previous E2E test area
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
    { id: 's1', spokenLabel: '明日の午前', fee: 0 }
  ])
}));

jest.mock('../services/DeliveryAddressService', () => ({
  listAddresses: jest.fn(async () => [
    { id: 'a1', spokenLabel: '自宅' }
  ]),
  getAddressByIndex: jest.fn(async (attributesManager, idx) => {
    const list = [{ id: 'a1', spokenLabel: '自宅' }];
    return list[idx - 1] || null;
  })
}));

// For promos: scenario where no promos available
jest.mock('../services/CheckoutService', () => ({
  calculate: jest.fn(async (cart, deliveryFee) => ({
    itemsTotal: 100,
    subtotal: 100,
    availablePromos: []
  })),
  finalize: jest.fn(async (cart, deliveryFee, promo) => ({ summary: '合計100円' }))
}));

jest.mock('../services/PaymentService', () => ({
  getPaymentMethods: jest.fn(() => [{ label: 'クレジットカード' }]),
  getWaonBalance: jest.fn(async () => 200),
  createPayment: jest.fn(async (attributesManager, session) => ({ success: false })) // simulate payment failure by default
}));

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
  };

  const built = {};
  const responseBuilder = {
    speak(text) { built.speak = text; return this; },
    reprompt(text) { built.reprompt = text; return this; },
    getResponse() { return built; }
  };

  return { requestEnvelope, attributesManager, responseBuilder };
}

describe('E2E additional flows', () => {
  test('user cancels mid-flow when asked to confirm address', async () => {
    // go to select address confirmation that asks "use this address?"
    const hiSearch = makeHandlerInput({ intentName: 'SearchAvailableDeliveryAddressIntent' });
    expect(SearchAvailableDeliveryAddressIntentHandler.canHandle(hiSearch)).toBe(true);
    const resSearch = await SearchAvailableDeliveryAddressIntentHandler.handle(hiSearch);
    // session pending set to confirmDefaultAddress
    const session = hiSearch.attributesManager.getSessionAttributes();
    expect(session.pending).toBe(true);
    expect(session.pendingData.kind).toBe('confirmDefaultAddress');

    // user says No to cancel address selection
    const hiNo = makeHandlerInput({ intentName: 'AMAZON.NoIntent', sessionAttrs: session });
    expect(PendingConfirmationHandler.canHandle(hiNo)).toBe(true);
    const resNo = await PendingConfirmationHandler.handle(hiNo);
    expect(resNo.speak).toContain('届け先の設定をキャンセルしました');
  });

  test('no available promotions path informs user how to proceed', async () => {
    // prepare a session with cart
    const session = { cart: [{ id: 'p1' }], cartDelivery: { fee: 0 } };
    const hi = makeHandlerInput({ intentName: 'SearchAvailablePromotionIntent', sessionAttrs: session });
    expect(SearchAvailablePromotionIntentHandler.canHandle(hi)).toBe(true);
    const res = await SearchAvailablePromotionIntentHandler.handle(hi);
    // since calculate returns no promos, it should inform that none available
    expect(res.speak).toMatch(/現在利用可能なクーポンはありません|あと/);
  });

  test('payment failure path informs user and asks to retry', async () => {
    // go to payment finalize confirmation
    const session = { pending: true, pendingData: { kind: 'confirmFinalizePayment' } };
    const hi = makeHandlerInput({ intentName: 'AMAZON.YesIntent', sessionAttrs: session });
    expect(PendingConfirmationHandler.canHandle(hi)).toBe(true);
    const res = await PendingConfirmationHandler.handle(hi);
    expect(res.speak).toContain('申し訳ありません。支払い処理で問題が発生しました');
  });

  test('WAON usage flow: user agrees to use WAON and asked points amount', async () => {
    // set pending for using WAON
    const session = { pending: true, pendingData: { kind: 'confirmUseWaon' } };
    const hiYes = makeHandlerInput({ intentName: 'AMAZON.YesIntent', sessionAttrs: session });
    expect(PendingConfirmationHandler.canHandle(hiYes)).toBe(true);
    const res = await PendingConfirmationHandler.handle(hiYes);
    expect(res.speak).toContain('ご利用可能なWAONポイントは');
    expect(res.speak).toMatch(/何ポイント使いますか/);
  });
});

