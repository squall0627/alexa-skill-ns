// lambda/adapters/MockAIAdapter.js
// テスト用のモック AI アダプター。固定レスポンスまたは簡易マッチングで応答を返す。

class MockAIAdapter {
  constructor() {}

  // prompt: string -> return { intent: string, sample: string, confidence: number }
  async call(prompt) {
    const full = String(prompt || '');
    // try to extract the Conversation: ... Intents: block to avoid matching intent samples
    let convo = full;
    try {
      const start = full.indexOf('Conversation:');
      const intentsIdx = full.indexOf('\n\nIntents:');
      if (start !== -1 && intentsIdx !== -1 && intentsIdx > start) {
        convo = full.substring(start + 'Conversation:'.length, intentsIdx);
      }
    } catch (e) {
      convo = full;
    }
    const lower = convo.toLowerCase();
    if (lower.includes('カート') || lower.includes('cart')) {
      return { intent: 'ViewCartIntent', sample: 'カートを見せて', confidence: 0.95 };
    }
    if (lower.includes('住所') || lower.includes('届け先') || lower.includes('address')) {
      return { intent: 'SearchAvailableDeliveryAddressIntent', sample: '住所を選ぶ', confidence: 0.9 };
    }
    if (lower.includes('配送') || lower.includes('delivery')) {
      return { intent: 'SearchAvailableDeliverySlotIntent', sample: '配送便を見せて', confidence: 0.9 };
    }
    if (lower.includes('クーポン') || lower.includes('coupon')) {
      return { intent: 'SearchAvailablePromotionIntent', sample: '利用できるクーポンを教えて', confidence: 0.9 };
    }

    // fallback low confidence
    return { intent: null, sample: null, confidence: 0.2 };
  }
}

module.exports = MockAIAdapter;
