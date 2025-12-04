// lambda/adapters/AIAdapter.js
// AI Adapter 抽象と简单的工場
// 日语注释

const MockAIAdapter = require('./MockAIAdapter');
let OpenAIAdapter = null;
let OllamaAdapter = null;
try {
  OpenAIAdapter = require('./OpenAIAdapter');
} catch (e) {
  // OpenAIAdapter はオプション。存在しない場合は無視。
}
try {
  OllamaAdapter = require('./OllamaAdapter');
} catch (e) {
  // OllamaAdapter optional
}

function createAdapter() {
  const kind = process.env.AI_ADAPTER || 'mock';
  if (kind === 'openai' && OpenAIAdapter) {
      console.log(`[AIAdapter] Using OpenAIAdapter`);
    return new OpenAIAdapter(process.env.OPENAI_API_KEY || null);
  }
  if (kind === 'ollama' && OllamaAdapter) {
      console.log(`[AIAdapter] Using OllamaAdapter`);
    const host = process.env.OLLAMA_HOST || null; // optional override
    const model = process.env.OLLAMA_MODEL || null;
    const timeout = process.env.OLLAMA_TIMEOUT_MS ? Number(process.env.OLLAMA_TIMEOUT_MS) : undefined;
    return new OllamaAdapter(host, model, timeout);
  }
  console.log(`[AIAdapter] Using MockAIAdapter`);
  return new MockAIAdapter();
}

module.exports = {
  createAdapter
};
