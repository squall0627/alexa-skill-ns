// routes/llm.js
// LLM バックエンドの擬似ロジック。セッション毎にカタログ/カート/ページング/確認を管理し、
// Alexa スキルへ日本語のレスポンスを返す。実運用では外部 LLM 連携や実在の在庫/注文 API と差し替える。

const fetch = require('node-fetch');
const { analyzeIntent } = require('../services/intentAnalyzeService');

const BACKEND_SECRET = process.env.BACKEND_SECRET;

// 簡易インメモリのセッションストア（本番は永続ストアを推奨）
const sessions = new Map();

// サンプル商品カタログ（実環境では DB/API から取得）
const CATALOG = [
  { id: 'SKU1001', title: '明治 おいしい牛乳 1L', brand: '明治', category: '牛乳', price: 198, rating: 4.6, stock: 50 },
  { id: 'SKU1002', title: '雪印 メグミルク 1L', brand: '雪印', category: '牛乳', price: 188, rating: 4.4, stock: 8 },
  { id: 'SKU1101', title: '森永 E赤ちゃん 粉ミルク 800g', brand: '森永', category: 'ベビー粉ミルク', price: 2480, rating: 4.7, stock: 20 },
  { id: 'SKU1102', title: '明治 ほほえみ 800g', brand: '明治', category: 'ベビー粉ミルク', price: 2550, rating: 4.8, stock: 5 },
  { id: 'SKU2001', title: 'キッコーマン 調製豆乳 1L', brand: 'キッコーマン', category: '豆乳', price: 158, rating: 4.5, stock: 60 },
  { id: 'SKU3001', title: 'サントリー 天然水 2L', brand: 'サントリー', category: '水', price: 98, rating: 4.3, stock: 100 },
  { id: 'SKU4001', title: '日清 カップヌードル 醤油', brand: '日清', category: 'カップ麺', price: 128, rating: 4.2, stock: 200 },
];

// サンプルのプロモーション/クーポン
const PROMOS = [
  { id: 'P10MILK', title: '牛乳カテゴリ 10%オフ クーポン', category: '牛乳', discountPct: 10 },
  { id: 'P200YEN', title: '2,000円以上で200円オフ', minTotal: 2000, discountYen: 200 },
];

// セッション初期化
function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      cart: [], // {id,title,price,qty}
      lastList: [],
      page: 0,
      pageSize: 3,
      pendingAction: null, // { type: 'checkout' | 'cancelOrder', payload: {...} }
      lastOrder: null, // { orderNo, status }
      pickupOrDelivery: null, // 'pickup' | 'delivery'
      coupons: [],
    });
  }
  return sessions.get(sessionId);
}

// 検索/フィルタ
function searchCatalog({ query, category, brand }) {
  const q = (query || '').toLowerCase();
  return CATALOG.filter(p => (
    (!category || p.category.includes(category)) &&
    (!brand || p.brand.includes(brand)) &&
    (!q || p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  ));
}

// ページング応答（2-3件を読む）
function listToSpeech(items, page, pageSize) {
  const start = page * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  const lines = pageItems.map((p, i) => {
    const idx = i + 1;
    return `${idx}番目、${p.title}、${p.price}円、評価${p.rating}。`;
  });
  const hasMore = start + pageSize < items.length;
  const head = items.length === 0 ? '該当商品が見つかりませんでした。' : `全部で${items.length}件です。`;
  const tail = hasMore ? '次のページを聞きますか？' : 'ご希望のものはありますか？';
  return { speech: `${head}${lines.length ? ' ' + lines.join(' ') : ''} ${tail}`, hasMore };
}

// カート合計
function cartTotal(cart) {
  return cart.reduce((sum, it) => sum + it.price * it.qty, 0);
}

// 金額にクーポン適用（簡易）
function applyCoupons(total, coupons, cart) {
  let discounted = total;
  for (const c of coupons) {
    if (c.discountPct && cart.some(it => it.category === (c.category || ''))) {
      discounted = Math.round(discounted * (100 - c.discountPct) / 100);
    }
    if (c.discountYen && total >= (c.minTotal || 0)) {
      discounted = Math.max(0, discounted - c.discountYen);
    }
  }
  return discounted;
}

// レスポンス組み立てヘルパー
function respond({ speech, reprompt = 'どうしますか？', shouldEndSession = false, sessionState }) {
  return {
    spokenResponse: speech,
    reprompt,
    shouldEndSession,
    sessionAttributes: sessionState,
  };
}

module.exports = async (req, res) => {
  // Alexa スキルからのシークレット検証
  const incomingSecret = req.headers['x-backend-secret'];
  if (!incomingSecret || incomingSecret !== BACKEND_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { sessionId, userText, intentName, locale, slots = {}, sessionAttributes, intents } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'missing sessionId' });

  // セッション状態
  const state = getSession(sessionId);
  // Alexa 側の属性があればマージ（バックエンド変更が優先）
  if (sessionAttributes && typeof sessionAttributes === 'object') {
    Object.assign(state, sessionAttributes);
  }

  try {
    // 日本語：Intent が指定されていない場合、ユーザーテキストからIntent分析
    let name = intentName || '';
    let analyzedParams = {};
    
    if (!name && userText && intents) {
      const analyzed = await analyzeIntent(userText, intents, state);
      name = analyzed.intent;
      analyzedParams = analyzed.params;
      console.log(`[Intent分析] ユーザー入力: "${userText}" → Intent: ${name}, パラメータ:`, analyzedParams);
    }
    
    // 日本語：分析されたパラメータをslotsにマージ（既存のslotsを優先）
    const mergedSlots = { ...analyzedParams, ...slots };

    // ページング（次へ/前へ）
    if (name === 'AMAZON.NextIntent') {
      if (state.lastList && state.lastList.length) {
        state.page = state.page + 1;
        const { speech, hasMore } = listToSpeech(state.lastList, state.page, state.pageSize);
        if (!hasMore) state.page = Math.min(state.page, Math.ceil(state.lastList.length / state.pageSize) - 1);
        return res.json(respond({ speech, sessionState: state }));
      }
      return res.json(respond({ speech: '続けられるリストがありません。何を検索しますか？', sessionState: state }));
    }
    if (name === 'AMAZON.PreviousIntent') {
      if (state.lastList && state.lastList.length) {
        state.page = Math.max(0, state.page - 1);
        const { speech } = listToSpeech(state.lastList, state.page, state.pageSize);
        return res.json(respond({ speech, sessionState: state }));
      }
      return res.json(respond({ speech: '前のページはありません。何を検索しますか？', sessionState: state }));
    }

    // Yes/No の確認フロー
    if (name === 'AMAZON.YesIntent') {
      if (state.pendingAction) {
        const act = state.pendingAction;
        state.pendingAction = null;
        if (act.type === 'checkout') {
          // 注文確定
          const total = cartTotal(state.cart);
          const discounted = applyCoupons(total, state.coupons, state.cart);
          const orderNo = 'O' + Math.floor(100000 + Math.random() * 900000);
          state.lastOrder = { orderNo, status: '受付済み', total: discounted };
          state.cart = [];
          const speech = `ご注文を確定しました。注文番号は${orderNo}です。お支払い金額は${discounted}円です。ほかにお手伝いはありますか？`;
          return res.json(respond({ speech, sessionState: state }));
        }
        if (act.type === 'cancelOrder') {
          if (state.lastOrder) {
            state.lastOrder.status = 'キャンセル済み';
            const speech = `注文番号${state.lastOrder.orderNo}をキャンセルしました。ほかにご用件はありますか？`;
            return res.json(respond({ speech, sessionState: state }));
          }
          return res.json(respond({ speech: 'キャンセルできる注文が見つかりません。', sessionState: state }));
        }
      }
      return res.json(respond({ speech: 'はっきりと理解できませんでした。もう一度お願いします。', sessionState: state }));
    }
    if (name === 'AMAZON.NoIntent') {
      if (state.pendingAction) {
        state.pendingAction = null;
        return res.json(respond({ speech: '了解しました。ほかにお手伝いはありますか？', sessionState: state }));
      }
      return res.json(respond({ speech: 'わかりました。他にお探しですか？', sessionState: state }));
    }

    // 商品検索
    if (name === 'SearchProductIntent') {
      const query = mergedSlots.ProductQuery || userText || '';
      const brand = mergedSlots.Brand || '';
      const category = mergedSlots.Category || '';
      const results = searchCatalog({ query, category, brand });
      state.lastList = results;
      state.page = 0;
      const { speech } = listToSpeech(results, state.page, state.pageSize);
      return res.json(respond({ speech, sessionState: state }));
    }

    // カテゴリ閲覧
    if (name === 'BrowseCategoryIntent') {
      const category = mergedSlots.Category || userText || '';
      const results = searchCatalog({ category });
      state.lastList = results;
      state.page = 0;
      const { speech } = listToSpeech(results, state.page, state.pageSize);
      return res.json(respond({ speech, sessionState: state }));
    }

    // アイテム選択（直近のリストからインデックス選択）
    if (name === 'SelectItemIntent') {
      const idxRaw = mergedSlots.ItemIndex || mergedSlots.Number || '';
      const idx = Math.max(1, parseInt(idxRaw, 10) || 1) - 1;
      const start = state.page * state.pageSize;
      const item = state.lastList[start + idx];
      if (!item) {
        return res.json(respond({ speech: 'その番号の商品が見つかりませんでした。別の番号でお試しください。', sessionState: state }));
      }
      state.selectedItem = item;
      return res.json(respond({ speech: `${item.title}ですね。カートに追加しますか？`, sessionState: state }));
    }

    // カートに追加
    if (name === 'AddToCartIntent') {
      const qty = Math.max(1, parseInt(mergedSlots.Quantity || '1', 10) || 1);
      let productId = mergedSlots.ProductId || '';
      let item = null;
      if (productId) {
        item = CATALOG.find(p => p.id === productId);
      } else if (state.selectedItem) {
        item = state.selectedItem;
      } else if (state.lastList && state.lastList.length) {
        item = state.lastList[0];
      }
      if (!item) {
        return res.json(respond({ speech: '追加する商品が特定できませんでした。もう一度商品を教えてください。', sessionState: state }));
      }
      if (item.stock < qty) {
        // 代替提案
        const alternatives = CATALOG.filter(p => p.category === item.category && p.stock >= qty && p.id !== item.id).slice(0,2);
        const altSpeech = alternatives.length ? `在庫が足りません。代わりに、${alternatives.map(a=>a.title).join('、')}はいかがですか？` : '在庫が足りません。数量を減らすか、別の商品をお試しください。';
        return res.json(respond({ speech: altSpeech, sessionState: state }));
      }
      const existing = state.cart.find(ci => ci.id === item.id);
      if (existing) existing.qty += qty; else state.cart.push({ id: item.id, title: item.title, price: item.price, qty, category: item.category });
      const speech = `${item.title}を${qty}点、カートに追加しました。ほかに必要なものはありますか？`;
      return res.json(respond({ speech, sessionState: state }));
    }

    // カートを見る
    if (name === 'ViewCartIntent') {
      if (!state.cart.length) return res.json(respond({ speech: 'カートは空です。何をお探しですか？', sessionState: state }));
      const lines = state.cart.map((it, i) => `${i+1}番目、${it.title}、${it.qty}点、${it.price}円。`).join(' ');
      const total = cartTotal(state.cart);
      const discounted = applyCoupons(total, state.coupons, state.cart);
      const discountLine = discounted !== total ? `割引後は${discounted}円です。` : '';
      const speech = `カートの中身は、${lines} 合計は${total}円です。${discountLine}このままお会計しますか？`;
      return res.json(respond({ speech, sessionState: state }));
    }

    // カートから削除
    if (name === 'RemoveFromCartIntent') {
      const idxRaw = mergedSlots.ItemIndex || mergedSlots.Number || '';
      const idx = Math.max(1, parseInt(idxRaw, 10) || 1) - 1;
      if (!state.cart[idx]) return res.json(respond({ speech: '指定された番号の商品がカートにありません。', sessionState: state }));
      const removed = state.cart.splice(idx, 1)[0];
      const speech = `${removed.title}をカートから削除しました。ほかにありますか？`;
      return res.json(respond({ speech, sessionState: state }));
    }

    // 支払い/受け取り方法選択
    if (name === 'ChooseFulfillmentIntent') {
      const method = mergedSlots.FulfillmentMethod || '';
      if (['店舗受け取り','受け取り','店頭受取','ピックアップ'].some(k=>method.includes(k))) state.pickupOrDelivery = 'pickup';
      else state.pickupOrDelivery = 'delivery';
      const speech = state.pickupOrDelivery === 'pickup' ? '店頭受け取りにします。お会計に進みますか？' : '配送にします。お会計に進みますか？';
      return res.json(respond({ speech, sessionState: state }));
    }

    // チェックアウト（確認要求）
    if (name === 'CheckoutIntent' || name === 'ConfirmOrderIntent') {
      if (!state.cart.length) return res.json(respond({ speech: 'カートが空のため、注文できません。先に商品を追加してください。', sessionState: state }));
      const total = cartTotal(state.cart);
      const discounted = applyCoupons(total, state.coupons, state.cart);
      const speech = `合計は${total}円です。${discounted!==total?`割引後は${discounted}円です。`:''}注文を確定しますか？`;
      state.pendingAction = { type: 'checkout' };
      return res.json(respond({ speech, sessionState: state }));
    }

    // 注文状況
    if (name === 'OrderStatusIntent') {
      if (!state.lastOrder) return res.json(respond({ speech: '直近の注文が見つかりません。', sessionState: state }));
      const speech = `注文番号${state.lastOrder.orderNo}の状況は「${state.lastOrder.status}」です。`;
      return res.json(respond({ speech, sessionState: state }));
    }

    // 注文キャンセル（確認要求）
    if (name === 'CancelOrderIntent') {
      if (!state.lastOrder) return res.json(respond({ speech: 'キャンセル可能な注文がありません。', sessionState: state }));
      state.pendingAction = { type: 'cancelOrder' };
      const speech = `注文番号${state.lastOrder.orderNo}をキャンセルしますか？`;
      return res.json(respond({ speech, sessionState: state }));
    }

    // クーポン適用
    if (name === 'ApplyCouponIntent') {
      const code = (mergedSlots.CouponCode || '').toUpperCase();
      const promo = PROMOS.find(p => p.id === code);
      if (!promo) return res.json(respond({ speech: 'そのクーポンは見つかりませんでした。', sessionState: state }));
      state.coupons.push(promo);
      const speech = `${promo.title}を適用しました。現在の合計に割引が反映されます。`;
      return res.json(respond({ speech, sessionState: state }));
    }

    // プロモーション案内
    if (name === 'PromotionsIntent') {
      const list = PROMOS.map(p => p.title).join('、');
      const speech = list ? `現在のキャンペーンは、${list}です。クーポンコードをお持ちなら「クーポンを適用」と言ってください。` : '現在利用できるキャンペーンはありません。';
      return res.json(respond({ speech, sessionState: state }));
    }

    // フォールバック — フリーテキストを簡易検索として扱う
    if (userText) {
      const results = searchCatalog({ query: userText });
      state.lastList = results;
      state.page = 0;
      const { speech } = listToSpeech(results, state.page, state.pageSize);
      return res.json(respond({ speech, sessionState: state }));
    }

    // 最終フォールバック
    return res.json(respond({ speech: 'すみません、うまく理解できませんでした。例えば「牛乳を検索」と言ってください。', sessionState: state }));
  } catch (err) {
    console.error('LLM route error', err);
    return res.status(500).json({ error: 'llm error' });
  }
};