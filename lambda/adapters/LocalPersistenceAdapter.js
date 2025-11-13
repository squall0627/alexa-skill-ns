/**
 * LocalPersistenceAdapter.js
 * 用于本地开发和 Lambda 模拟器的持久化适配器
 * 将数据保存到文件系统 (/tmp 或相对路径) 而不是 DynamoDB
 */

const fs = require('fs');
const path = require('path');

// 在 Lambda 环境中只能使用 /tmp 目录
// 在本地开发中使用相对路径的 data 目录
const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
const DATA_DIR = isLambda 
    ? '/tmp/alexa-sessions'
    : path.join(__dirname, '../data');
const SESSION_FILE = path.join(DATA_DIR, 'sessions.json');

console.log(`[LocalPersistenceAdapter] Using data directory: ${DATA_DIR}`);

// 确保数据目录存在
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log(`[LocalPersistenceAdapter] Created data directory: ${DATA_DIR}`);
    }
} catch (error) {
    console.error(`[LocalPersistenceAdapter] Failed to create data directory: ${error.message}`);
}

// 初始化或加载已有的会话数据
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
            
            // 确保目录存在
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }
            
            // 写入文件
            fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
            console.log(`[LocalPersistenceAdapter] Attributes saved successfully for ${userId}`);
        } catch (error) {
            console.error(`[LocalPersistenceAdapter] Error saving attributes: ${error.message}`);
            // 在 Lambda 中如果 /tmp 不可用，只在内存中保存
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
