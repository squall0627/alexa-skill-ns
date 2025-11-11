// utils/auth.js
// バックエンド間の共有シークレットを検証するミドルウェア

const BACKEND_SECRET = process.env.BACKEND_SECRET;

/**
 * x-backend-secret を検証する Express ミドルウェア
 */
function verifySecret(req, res, next) {
  // 日本語コメント：スキルからの呼び出しのみを許可するため簡易な共有鍵を確認
  const incoming = req.headers['x-backend-secret'];
  if (!incoming || incoming !== BACKEND_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

module.exports = { verifySecret };
