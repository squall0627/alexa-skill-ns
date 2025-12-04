#!/usr/bin/env node
const path = require('path');

(async () => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    if (!process.env.OPENAI_MODEL) {
      process.env.OPENAI_MODEL = 'gpt-5-nano';
    }
    const OpenAIAdapter = require(path.join(__dirname, '..', '..', 'adapters', 'OpenAIAdapter.js'));
    const prompt = `You are given a short conversation between a user and an Alexa shopping skill (in Japanese). Choose the best matching intent from the provided list of intents. REQUIRED: Output JSON ONLY, and NOTHING ELSE. The JSON must have these keys:\n- intent: the exact intent name from the provided list (string), or null if none matches.\n- sample: a single representative sample utterance in Japanese that the skill would accept for that intent (string), or null if intent is null.\n- confidence: a float between 0 and 1 indicating your confidence in the mapping.\n- slots: optional object mapping slotName -> value (strings), include only when you are confident.\nIf there is no suitable intent, return {\"intent\": null, \"sample\": null, \"confidence\": 0}. Do NOT add any explanatory text, commentary, or additional keys. Respond with valid JSON only.\nConversation:\nUSER: カートの中身を確認したいんだけど。\nASSISTANT: ご用件を詳しく教えてください。\nUSER: 今のカートを見せて。\nIntents:\n- ViewCartIntent: samples => カートを見せて | カートの中身を教えて | カートの内容を表示して\n- ClearCartIntent: samples => カートを空にして | カートを削除 | カートをリセット\n- AddCartIntent: samples => 牛乳を2本カートに追加 | カートに卵を入れて\nRespond with JSON.`;

    const adapter = new OpenAIAdapter(process.env.OPENAI_API_KEY);
    const result = await adapter.call(prompt);
    console.log(JSON.stringify({ ok: true, result }));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) }));
    process.exitCode = 1;
  }
})();

