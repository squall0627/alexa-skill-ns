const SelectDeliveryAddressIntentHandler = require('../handlers/SelectDeliveryAddressIntentHandler');

function makeHandlerInput({ slotValue = '1', sessionAttrs = {} } = {}) {
  return {
    requestEnvelope: {
      request: {
        type: 'IntentRequest',
        intent: {
          name: 'SelectDeliveryAddressIntent',
          slots: slotValue !== undefined ? { AddressNumber: { name: 'AddressNumber', value: slotValue } } : {}
        }
      }
    },
    attributesManager: {
      _session: Object.assign({}, sessionAttrs),
      getSessionAttributes() { return this._session; },
      setSessionAttributes(s) { this._session = s; }
    },
    responseBuilder: {
      speak(text) { this._s = text; return this; },
      reprompt(text) { this._r = text; return this; },
      getResponse() { return { spoken: this._s, reprompt: this._r }; }
    }
  };
}

describe('SelectDeliveryAddressIntentHandler', () => {
  test('select valid address sets cartDelivery', async () => {
    const sessionAttrs = { availableDeliveryAddresses: [{ id: 'a1', spokenLabel: '自宅' }, { id: 'a2', spokenLabel: '勤務先' }], lastAction: 'SearchAvailableDeliveryAddressIntent' };
    const hi = makeHandlerInput({ slotValue: '2', sessionAttrs });
    const res = await SelectDeliveryAddressIntentHandler.handle(hi);
    const after = hi.attributesManager.getSessionAttributes();
    expect(after.cartDeliveryAddress).toBeDefined();
    expect(after.cartDeliveryAddress.spokenLabel).toMatch(/勤務先/);
    expect(res.spoken).toMatch(/配送先を選択しました/);
  });

  test('out of range number reprompts', async () => {
    const sessionAttrs = { availableDeliveryAddresses: [{ id: 'a1', spokenLabel: '自宅' }], lastAction: 'SearchAvailableDeliveryAddressIntent' };
    const hi = makeHandlerInput({ slotValue: '3', sessionAttrs });
    const res = await SelectDeliveryAddressIntentHandler.handle(hi);
    expect(res.spoken).toMatch(/番号は1から1の間で教えてください/);
  });
});
