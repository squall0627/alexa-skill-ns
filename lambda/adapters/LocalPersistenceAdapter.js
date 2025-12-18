/**
 * LocalPersistenceAdapter.js
 * ローカル開発および Lambda シミュレータ用の永続化アダプタ
 * データを DynamoDB の代わりにファイルシステム（/tmp または相対パス）に保存します
 */

const fs = require('fs');
const path = require('path');

// Lambda 環境では /tmp ディレクトリのみが使用可能
// ローカル開発では相対パスの data ディレクトリを使用
const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
const DATA_DIR = isLambda 
    ? '/tmp/alexa-sessions'
    : path.join(__dirname, '../data');
const SESSION_FILE = path.join(DATA_DIR, 'sessions.json');

console.log(`[LocalPersistenceAdapter] Using data directory: ${DATA_DIR}`);

// データディレクトリの存在を確認
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log(`[LocalPersistenceAdapter] Created data directory: ${DATA_DIR}`);
    }
} catch (error) {
    console.error(`[LocalPersistenceAdapter] Failed to create data directory: ${error.message}`);
}

// セッションデータを初期化または既存ファイルからロード
let sessionData = {};
try {
    if (fs.existsSync(SESSION_FILE)) {
        const fileContent = fs.readFileSync(SESSION_FILE, 'utf8');
        sessionData = JSON.parse(fileContent);
        console.log('[LocalPersistenceAdapter] Loaded existing sessions from file');
    }
} catch (error) {
    console.log('[LocalPersistenceAdapter] Error loading sessions file, starting fresh:', error.message);
    sessionData = {};
}

class LocalPersistenceAdapter {
    constructor() {
        this.tableName = 'AlexaSkillsKit.Sessions';
    }

    async getAttributes(requestEnvelope) {
        try {
            const userId = requestEnvelope.context.System.user.userId;
            console.log(`[LocalPersistenceAdapter] Getting attributes for user: ${userId}`);
            
            if (sessionData[userId]) {
                console.log(`[LocalPersistenceAdapter] Found persisted attributes for ${userId}:`, sessionData[userId]);
                return sessionData[userId];
            }
            
            console.log(`[LocalPersistenceAdapter] No persisted attributes found for ${userId}, returning empty object`);
            return {};
        } catch (error) {
            console.log('[LocalPersistenceAdapter] Error getting attributes:', error);
            return {};
        }
    }

    async saveAttributes(requestEnvelope, attributes) {
        try {
            const userId = requestEnvelope.context.System.user.userId;
            console.log(`[LocalPersistenceAdapter] Saving attributes for user: ${userId}`);
            
            sessionData[userId] = attributes;
            
            // ディレクトリが存在することを確認
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }
            
            // ファイルに書き込む
            fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
            console.log(`[LocalPersistenceAdapter] Attributes saved successfully for ${userId}`);
        } catch (error) {
            console.error(`[LocalPersistenceAdapter] Error saving attributes: ${error.message}`);
            // Lambda で /tmp が使えない場合はメモリ上のみ保存される可能性があります
            console.warn(`[LocalPersistenceAdapter] Warning: Data may not persist between invocations`);
        }
    }

    async deleteAttributes(requestEnvelope) {
        try {
            const userId = requestEnvelope.context.System.user.userId;
            console.log(`[LocalPersistenceAdapter] Deleting attributes for user: ${userId}`);
            
            delete sessionData[userId];
            fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
            console.log(`[LocalPersistenceAdapter] Attributes deleted successfully for ${userId}`);
        } catch (error) {
            console.log('[LocalPersistenceAdapter] Error deleting attributes:', error);
        }
    }
}

module.exports = LocalPersistenceAdapter;
