/**
 * PersistenceAdapterFactory.js
 * 根据环境动态选择持久化适配器
 */

const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const LocalPersistenceAdapter = require('./LocalPersistenceAdapter');

function getPersistenceAdapter() {
    const env = process.env.NODE_ENV || 'local';
    const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
    
    console.log(`[PersistenceAdapterFactory] Environment: ${env}, IsLambda: ${isLambda}`);
    
    // 优先级:
    // 1. 如果指定了 NODE_ENV=production，使用 DynamoDB
    // 2. 如果运行在 Lambda 环境且没有明确设置为 local，优先使用 DynamoDB
    // 3. 否则使用本地适配器 (本地开发或 Lambda 模拟器)
    
    if (env === 'production') {
        console.log('[PersistenceAdapterFactory] Using DynamoDB adapter (production)');
        return new DynamoDbPersistenceAdapter({
            tableName: 'AlexaSkillsKit.Sessions',
            createTable: true
        });
    }
    
    if (isLambda && env !== 'local' && env !== 'development') {
        console.log('[PersistenceAdapterFactory] Using DynamoDB adapter (Lambda detected)');
        return new DynamoDbPersistenceAdapter({
            tableName: 'AlexaSkillsKit.Sessions',
            createTable: true
        });
    }
    
    console.log('[PersistenceAdapterFactory] Using Local adapter (local development or Lambda simulator)');
    return new LocalPersistenceAdapter();
}

module.exports = {
    getPersistenceAdapter
};
