// utils/paging.js
// 日本語：リスト読み上げ文面の生成とページングヘルパー

/**
 * ページング応答（2-3件を読む）
 */
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

module.exports = { listToSpeech };
