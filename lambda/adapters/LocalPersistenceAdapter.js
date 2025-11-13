/**
 * LocalPersistenceAdapter.js
 * 用于本地开发的模拟持久化适配器
 * 将数据保存到文件系统而不是 DynamoDB
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const SESSION_FILE = path.join(DATA_DIR, 'sessions.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化或加载已有的会话数据
let sessionData = {};
if (fs.existsSync(SESSION_FILE)) {
    try {
        sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        console.log('[LocalPersistenceAdapter] Loaded existing sessions from file');
    } catch (error) {
        console.log('[LocalPersistenceAdapter] Error loading sessions file, starting fresh:', error);
        sessionData = {};
    }
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
            console.log(`[LocalPersistenceAdapter] Saving attributes for user: ${userId}`, attributes);
            
            sessionData[userId] = attributes;
            
            // 写入文件
            fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
            console.log(`[LocalPersistenceAdapter] Attributes saved successfully for ${userId}`);
        } catch (error) {
            console.log('[LocalPersistenceAdapter] Error saving attributes:', error);
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
