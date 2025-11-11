// index.js - Alexa Lambda handler
// lexa Lambda エントリポイント。Intent 毎の独立ハンドラを登録し、未実装は LLM フォワーダにフォールバックします。
const Alexa = require('ask-sdk-core');

// 個別ハンドラの読み込み
const LaunchRequestHandler = require('./handlers/LaunchRequestHandler');
const SearchProductIntentHandler = require('./handlers/SearchProductIntentHandler');
const BrowseCategoryIntentHandler = require('./handlers/BrowseCategoryIntentHandler');
const SelectItemIntentHandler = require('./handlers/SelectItemIntentHandler');
const HelpIntentHandler = require('./handlers/HelpIntentHandler');
const CancelAndStopIntentHandler = require('./handlers/CancelAndStopIntentHandler');
const SessionEndedRequestHandler = require('./handlers/SessionEndedRequestHandler');
const ErrorHandler = require('./handlers/ErrorHandler');

// ハンドラ登録。個別ハンドラのみ登録。未処理のIntentはErrorHandlerでLLMに委譲。
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    SearchProductIntentHandler,
    BrowseCategoryIntentHandler,
    SelectItemIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();