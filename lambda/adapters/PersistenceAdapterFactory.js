/**
 * PersistenceAdapterFactory.js
 * 根据环境动态选择持久化适配器
 */

const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const LocalPersistenceAdapter = require('./LocalPersistenceAdapter');

function getPersistenceAdapter() {
    const env = process.env.NODE_ENV || 'local';
    console.log(`[PersistenceAdapterFactory] Using ${env} persistence adapter`);
    
    if (env === 'production' || env === 'lambda') {
        // 生产环境使用 DynamoDB
        return new DynamoDbPersistenceAdapter({
            tableName: 'AlexaSkillsKit.Sessions',
            createTable: true
        });
    } else {
        // 本地开发使用文件系统
        return new LocalPersistenceAdapter();
    }
}

module.exports = {
    getPersistenceAdapter
};
