/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');
const { getPersistenceAdapter } = require('./adapters/PersistenceAdapterFactory');
const CartPersistenceHelper = require('./utils/CartPersistenceHelper');

const SearchProductIntentHandler = require('./handlers/SearchProductIntentHandler');
const AddCartIntentHandler = require('./handlers/AddCartIntentHandler');
const ProvideAddQuantityIntentHandler = require('./handlers/ProvideAddQuantityIntentHandler');
const DeleteCartIntentHandler = require('./handlers/DeleteCartIntentHandler');
const ProvideDeleteQuantityIntentHandler = require('./handlers/ProvideDeleteQuantityIntentHandler');
const ViewCartIntentHandler = require('./handlers/ViewCartIntentHandler');
const ClearCartIntentHandler = require('./handlers/ClearCartIntentHandler');
const PendingConfirmationHandler = require('./handlers/PendingConfirmationHandler');
const AfterAddDecisionHandler = require('./handlers/AfterAddDecisionHandler');
const SearchAvailableDeliverySlotIntentHandler = require('./handlers/SearchAvailableDeliverySlotIntentHandler');
const SelectDeliverySlotIntentHandler = require('./handlers/SelectDeliverySlotIntentHandler');
const SearchAvailablePromotionIntentHandler = require('./handlers/SearchAvailablePromotionIntentHandler');
const SelectPromotionIntentHandler = require('./handlers/SelectPromotionIntentHandler');
const StopOrderHandler = require('./handlers/StopOrderHandler');
const NumberOnlyIntentHandler = require('./handlers/NumberOnlyIntentHandler');
const SearchAvailableDeliveryAddressIntentHandler = require('./handlers/SearchAvailableDeliveryAddressIntentHandler');
const SelectDeliveryAddressIntentHandler = require('./handlers/SelectDeliveryAddressIntentHandler');
const StartPaymentIntentHandler = require('./handlers/StartPaymentIntentHandler');
const SelectPaymentMethodIntentHandler = require('./handlers/SelectPaymentMethodIntentHandler');
const SpecifyWaonPointsIntentHandler = require('./handlers/SpecifyWaonPointsIntentHandler');
const ConfirmOrderIntentHandler = require('./handlers/ConfirmOrderIntentHandler');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        console.log('LaunchRequest invoked');
        const attributesManager = handlerInput.attributesManager;
        const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
        const sessionAttributes = attributesManager.getSessionAttributes() || {};

        const persistentCart = persistentAttributes.cartData && Array.isArray(persistentAttributes.cartData.cart)
            ? persistentAttributes.cartData.cart
            : [];
        const sessionCart = Array.isArray(sessionAttributes.cart) ? sessionAttributes.cart : [];
        const cartCount = sessionCart.length || persistentCart.length;

        let speakOutput;
        let reprompt;
        if (cartCount > 0) {
            speakOutput = `<speak>おかえりなさい。現在カートに${cartCount}件の商品が入っています。<break time="0.5s"/>続きを操作しますか？<break time="0.5s"/>例えば「カートを見せて」と言ってください。</speak>`;
            reprompt = '続きを操作しますか？例えば「カートを見せて」と言ってください。';
        } else {
            speakOutput = `<speak>イオンネットスーパーへようこそ。商品を検索したり、カートに追加したり、注文を確認できます。<break time="0.5s"/>例えば「りんごを探して」や「カートを見せて」と話しかけてください。<break time="0.5s"/>クーポンの利用や配送日時の指定も可能です。ご希望の操作をお知らせください。</speak>`;
            reprompt = '何をしますか？例えば「りんごを探して」と言ってください。';
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        console.log('HelpIntent invoked');
        const speakOutput = `<speak>` +
            `こちらでは、以下の操作ができます。<break time="0.4s"/>` +
            `1. 商品検索の方法。音声で商品名やカテゴリを指定します。<break time="0.4s"/>例えば「りんごを探して」「乳製品を表示して」「お茶のブランドを見せて」。<break time="0.6s"/>` +
            `2. カートの確認・操作。カートの中身は「カートを見せて」で確認します。商品を追加するには「1番を追加して」「りんごを2個入れて」、削除は「1番を削除して」、数量変更は「1番を2個にして」と言ってください。<break time="0.6s"/>` +
            `3. 配送便の選択。利用可能な配送便は「配送便を見せて」で確認できます。指定するには「明日の午後に届けて」「今週土曜日の午前にして」と話してください。<break time="0.6s"/>` +
            `4. 配送先の選択。登録済みの住所を切り替えたり、新しい住所を選べます。例：「配送先を選ぶ」「配送先を変更して」「自宅に届けて」。<break time="0.6s"/>` +
            `5. クーポンの利用。利用できるクーポンは「利用できるクーポンを教えて」で確認できます。クーポンを適用するには「クーポンを使ってください」と伝えてください。<break time="0.6s"/>` +
            `6. 支払い方法。支払いに進むときは「支払いに進む」と言ってください。支払い方法の選択やポイント利用（例：「500ポイント使う」）もここで行えます。<break time="0.6s"/>` +
            `7. 注文の最終確認と確定。注文内容を確認するには「注文を確認して」、確定するには「注文を確定する」と言ってください。<break time="0.4s"/>` +
            `必要なら、操作手順を順を追って案内します。どれを試しますか？` +
            `</speak>`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('何を試しますか？例えば「りんごを探して」や「カートを見せて」と言ってください。')
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        console.log('CancelOrStopIntent invoked');
        const speakOutput = 'ご利用ありがとうございました。またのご来店をお待ちしております。';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        console.log('FallbackIntent invoked');
        const speakOutput = '申し訳ありません。そのリクエストはよく分かりませんでした。もう一度お願いできますか？';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        console.log('IntentReflector invoked');
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `「${intentName}」というインテントを受け取りました。`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/* *
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = '申し訳ありません。リクエストを処理できませんでした。もう一度お試しください。';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * 请求前的拦截器：从持久化存储加载购物车数据
 * 在每个请求开始时，将持久化的购物车数据加载到 session attributes 中
 */
const LoadCartInterceptor = {
    async process(handlerInput) {
        console.log('[LoadCartInterceptor] Loading persistent cart data...');
        try {
            const attributesManager = handlerInput.attributesManager;
            const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
            const sessionAttributes = attributesManager.getSessionAttributes() || {};

            // 只从 unified cartData 加载
            const cartData = persistentAttributes.cartData || null;
            if (cartData) {
                sessionAttributes.cart = Array.isArray(cartData.cart) ? cartData.cart : [];
                if (cartData.cartDelivery) sessionAttributes.cartDelivery = cartData.cartDelivery;
                if (cartData.cartDeliveryAddress) sessionAttributes.cartDeliveryAddress = cartData.cartDeliveryAddress;
                console.log('[LoadCartInterceptor] Loaded cartData');
            }

            // orderHistory 仍然单独加载
            if (persistentAttributes.orderHistory) {
                sessionAttributes.orderHistory = persistentAttributes.orderHistory;
            }

            attributesManager.setSessionAttributes(sessionAttributes);
        } catch (error) {
            console.log(`[LoadCartInterceptor] Error loading persistent attributes: ${error}`);
        }
    }
};

/**
 * 响应后的拦截器：保存购物车数据到持久化存储
 * 在每个响应之后，将 session 中的购物车数据保存到持久化存储
 */
const SaveCartInterceptor = {
    async process(handlerInput) {
        console.log('[SaveCartInterceptor] Checking whether to save cartData...');
        try {
            const attributesManager = handlerInput.attributesManager;
            const sessionAttributes = attributesManager.getSessionAttributes() || {};
            const persistentAttributes = await attributesManager.getPersistentAttributes() || {};

            // 只有在必要时才写入（脏标记或内容变化）
            const existingCartData = persistentAttributes.cartData || null;
            if (CartPersistenceHelper.shouldSave(sessionAttributes, existingCartData)) {
                persistentAttributes.cartData = CartPersistenceHelper.buildCartData(sessionAttributes);
                // other persistent fields
                if (sessionAttributes.lastSearchResults) persistentAttributes.lastSearchResults = sessionAttributes.lastSearchResults;
                if (sessionAttributes.lastSearchQuery) persistentAttributes.lastSearchQuery = sessionAttributes.lastSearchQuery;
                persistentAttributes.lastUpdate = new Date().toISOString();

                attributesManager.setPersistentAttributes(persistentAttributes);
                await attributesManager.savePersistentAttributes();
                console.log('[SaveCartInterceptor] cartData persisted');

                // 清除脏标记
                if (sessionAttributes._cartDirty) {
                    delete sessionAttributes._cartDirty;
                    attributesManager.setSessionAttributes(sessionAttributes);
                }
            } else {
                console.log('[SaveCartInterceptor] No changes detected, skipping save');
            }
        } catch (error) {
            console.log(`[SaveCartInterceptor] Error saving persistent attributes: ${error}`);
        }
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        SearchProductIntentHandler,
        AddCartIntentHandler,
        ProvideAddQuantityIntentHandler,
        DeleteCartIntentHandler,
        ProvideDeleteQuantityIntentHandler,
        ViewCartIntentHandler,
        ClearCartIntentHandler,
        PendingConfirmationHandler,
        AfterAddDecisionHandler,
        SearchAvailableDeliverySlotIntentHandler,
        SelectDeliverySlotIntentHandler,
        SearchAvailableDeliveryAddressIntentHandler,
        SelectDeliveryAddressIntentHandler,
        SearchAvailablePromotionIntentHandler,
        SelectPromotionIntentHandler,
        StartPaymentIntentHandler,
        SelectPaymentMethodIntentHandler,
        SpecifyWaonPointsIntentHandler,
        ConfirmOrderIntentHandler,
        StopOrderHandler,
        NumberOnlyIntentHandler,
        IntentReflectorHandler)
    .addRequestInterceptors(LoadCartInterceptor)
    .addResponseInterceptors(SaveCartInterceptor)
    .addErrorHandlers(ErrorHandler)
    .withPersistenceAdapter(getPersistenceAdapter())
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();