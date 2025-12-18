/**
 * PersistenceAdapterFactory.js
 * 環境に応じて永続化アダプタを動的に選択します
 */

const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const LocalPersistenceAdapter = require('./LocalPersistenceAdapter');

function getPersistenceAdapter() {
    const env = process.env.NODE_ENV || 'local';
    const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
    
    console.log(`[PersistenceAdapterFactory] Environment: ${env}, IsLambda: ${isLambda}`);
    
    // 優先順位:
    // 1. NODE_ENV=production が指定されていれば DynamoDB を使用
    // 2. Lambda 環境でかつ明示的に local と設定されていない場合は DynamoDB を優先
    // 3. それ以外（ローカル開発または Lambda シミュレータ）ではローカルアダプタを使用

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
