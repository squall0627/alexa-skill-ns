const path = require('path');
const OpenAIAdapter = require(path.join(__dirname, '..', 'adapters', 'OpenAIAdapter.js'));

const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
const liveEnabled = process.env.OPENAI_LIVE_TEST === '1';
const vmModulesEnabled = ((process.env.NODE_OPTIONS || '').includes('--experimental-vm-modules'));
const describeOrSkip = (hasApiKey && liveEnabled && vmModulesEnabled) ? describe : describe.skip;

if (!hasApiKey) {
  console.warn('[OpenAIAdapter.live.test] OPENAI_API_KEY が未設定のためスキップされます');
}
if (!liveEnabled) {
  console.warn('[OpenAIAdapter.live.test] OPENAI_LIVE_TEST=1 が未指定のためスキップされます');
}
if (!vmModulesEnabled) {
  console.warn('[OpenAIAdapter.live.test] NODE_OPTIONS に --experimental-vm-modules を含めてください (例: NODE_OPTIONS=--experimental-vm-modules npx jest ...)');
}

describeOrSkip('OpenAIAdapter ライブテスト', () => {
  const originalModel = process.env.OPENAI_MODEL;
  const originalAdapter = process.env.AI_ADAPTER;

  beforeAll(() => {
    jest.setTimeout(60000);
    process.env.AI_ADAPTER = 'openai';
    if (!process.env.OPENAI_MODEL) {
      process.env.OPENAI_MODEL = 'gpt-5-nano';
    }
  });

  afterAll(() => {
    if (originalModel) {
      process.env.OPENAI_MODEL = originalModel;
    } else {
      delete process.env.OPENAI_MODEL;
    }
    if (originalAdapter) {
      process.env.AI_ADAPTER = originalAdapter;
    } else {
      delete process.env.AI_ADAPTER;
    }
  });

  test('実際の応答から ViewCartIntent を取得できる', async () => {
    const adapter = new OpenAIAdapter(process.env.OPENAI_API_KEY);
    const prompt = `You are given a short conversation between a user and an Alexa shopping skill (in Japanese). Choose the best matching intent from the provided list of intents. REQUIRED: Output JSON ONLY, and NOTHING ELSE. The JSON must have these keys:\n- intent: the exact intent name from the provided list (string), or null if none matches.\n- sample: a single representative sample utterance in Japanese that the skill would accept for that intent (string), or null if intent is null.\n- confidence: a float between 0 and 1 indicating your confidence in the mapping.\n- slots: optional object mapping slotName -> value (strings), include only when you are confident.\nIf there is no suitable intent, return {\"intent\": null, \"sample\": null, \"confidence\": 0}. Do NOT add any explanatory text, commentary, or additional keys. Respond with valid JSON only.\nConversation:\nUSER: カートの中身を確認したいんだけど。\nASSISTANT: ご用件を詳しく教えてください。\nUSER: 今のカートを見せて。\nIntents:\n- ViewCartIntent: samples => カートを見せて | カートの中身を教えて | カートの内容を表示して\n- ClearCartIntent: samples => カートを空にして | カートを削除 | カートをリセット\n- AddCartIntent: samples => 牛乳を2本カートに追加 | カートに卵を入れて\nRespond with JSON.`;

    const result = await adapter.call(prompt);
    console.log(result);

    expect(result).toBeTruthy();
    expect(result.intent).toBe('ViewCartIntent');
    expect(result.sample).toMatch(/カート/);
    expect(result.confidence).toBeGreaterThan(0);
  });
});
