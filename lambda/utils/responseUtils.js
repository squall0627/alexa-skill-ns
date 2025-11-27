// lambda/utils/responseUtils.js
// Helpers to build nicely formatted Alexa cards and attach them alongside speech responses.

function buildCartCard(cart) {
  if (!cart || cart.length === 0) {
    return 'カートは空です。\n\n商品を追加してみましょう。';
  }
  const lines = [];
  let total = 0;
  cart.forEach((item, idx) => {
    const num = idx + 1;
    const name = item.name || '商品';
    const qty = item.quantity || 1;
    const unit = (item.promoPrice && item.promoPrice < item.price) ? item.promoPrice : (item.price || 0);
    const lineTotal = unit * qty;
    total += lineTotal;
    lines.push(`${num}. ${name}`);
    lines.push(`   数量: ${qty}  単価: ${unit}円  小計: ${lineTotal}円`);
  });
  lines.push('');
  lines.push(`合計: ${total}円`);
  return lines.join('\n');
}

function buildAddressCard(address) {
  if (!address) return '届け先の情報がありません。';
  const parts = [];
  if (address.spokenLabel) parts.push(address.spokenLabel);
  if (address.label) parts.push(`ラベル: ${address.label}`);
  if (address.fullAddress) parts.push(`住所: ${address.fullAddress}`);
  if (address.postalCode) parts.push(`郵便番号: ${address.postalCode}`);
  if (address.phone) parts.push(`電話番号: ${address.phone}`);
  if (address.note) parts.push(`備考: ${address.note}`);
  return parts.join('\n');
}

function buildPromotionCard(promotions) {
  if (!promotions || promotions.length === 0) return '利用可能なクーポンはありません。';
  const lines = ['利用可能なクーポン:'];
  promotions.forEach((p, idx) => {
    const num = idx + 1;
    const title = p.title || p.code || `クーポン${num}`;
    const desc = p.description || '';
    lines.push(`${num}. ${title} ${desc}`.trim());
  });
  return lines.join('\n');
}

function buildGenericCard(title, body) {
  const b = (typeof body === 'string') ? body : JSON.stringify(body, null, 2);
  return `${b}`;
}

function attachSpeechAndCard(responseBuilder, speech, cardTitle, cardContent, image) {
  // speech: SSML or plain text (string). cardContent: plain text string.
  const rb = responseBuilder.speak(speech);
  // Prefer Standard card if images provided and method exists.
  try {
    if (image && (image.smallImageUrl || image.largeImageUrl) && typeof rb.withStandardCard === 'function') {
      rb.withStandardCard(cardTitle || '通知', cardContent || '', image.smallImageUrl || '', image.largeImageUrl || image.smallImageUrl || '');
    } else if (typeof rb.withSimpleCard === 'function') {
      rb.withSimpleCard(cardTitle || '通知', cardContent || '');
    }
  } catch (e) {
    // If card attachment fails for any reason, just return response builder with speech.
    console.warn('attachSpeechAndCard: failed to attach card', e);
  }
  return rb;
}

module.exports = {
  buildCartCard,
  buildAddressCard,
  buildPromotionCard,
  buildGenericCard,
  attachSpeechAndCard
};
