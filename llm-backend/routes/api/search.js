// routes/api/search.js
// 日本語：検索/カテゴリ閲覧/アイテム選択に関する API ルート

const express = require('express');
const { getSession, mergeAttributes } = require('../../services/sessionStore');
const { searchCatalog } = require('../../services/catalogService');
const { listToSpeech } = require('../../utils/paging');
const { respond } = require('../../utils/response');

const router = express.Router();

// POST /api/search/products
router.post('/products', (req, res) => {
  const { sessionId, slots = {}, userText, sessionAttributes } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'missing sessionId' });
  const state = mergeAttributes(getSession(sessionId), sessionAttributes);

  const query = slots.ProductQuery || userText || '';
  const brand = slots.Brand || '';
  const category = slots.Category || '';
  const results = searchCatalog({ query, category, brand });
  state.lastList = results;
  state.page = 0;
  const { speech } = listToSpeech(results, state.page, state.pageSize);
  return res.json(respond({ speech, sessionState: state }));
});

// POST /api/browse/category
router.post('/category', (req, res) => {
  const { sessionId, slots = {}, userText, sessionAttributes } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'missing sessionId' });
  const state = mergeAttributes(getSession(sessionId), sessionAttributes);

  const category = slots.Category || userText || '';
  const results = searchCatalog({ category });
  state.lastList = results;
  state.page = 0;
  const { speech } = listToSpeech(results, state.page, state.pageSize);
  return res.json(respond({ speech, sessionState: state }));
});

// POST /api/select/item
router.post('/select', (req, res) => {
  const { sessionId, slots = {}, sessionAttributes } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'missing sessionId' });
  const state = mergeAttributes(getSession(sessionId), sessionAttributes);

  const idxRaw = slots.ItemIndex || slots.Number || '';
  const idx = Math.max(1, parseInt(idxRaw, 10) || 1) - 1;
  const start = state.page * state.pageSize;
  const item = (state.lastList || [])[start + idx];
  if (!item) {
    return res.json(respond({ speech: 'その番号の商品が見つかりませんでした。別の番号でお試しください。', sessionState: state }));
  }
  state.selectedItem = item;
  return res.json(respond({ speech: `${item.title}ですね。カートに追加しますか？`, sessionState: state }));
});

module.exports = router;
