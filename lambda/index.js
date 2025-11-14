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
const AfterAddDecisionHandler = require('./handlers/AfterAddDecisionHandler');
const SelectDeliverySlotIntentHandler = require('./handlers/SelectDeliverySlotIntentHandler');
const ChooseDeliverySlotIntentHandler = require('./handlers/ChooseDeliverySlotIntentHandler');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.log('LaunchRequest invoked');
        const speakOutput = 'Welcome, you can say Hello or Help. Which would you like to try?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
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
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
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
        const speakOutput = 'Goodbye!';

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
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

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
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
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
                const newCartData = CartPersistenceHelper.buildCartData(sessionAttributes);
                persistentAttributes.cartData = newCartData;
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
 * 当用户开始新订单或取消订单时，清空购物车的处理
 */
const ClearCartHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent';
    },
    async handle(handlerInput) {
        console.log('[ClearCartHandler] Cancelling order and clearing cart...');
        const attributesManager = handlerInput.attributesManager;
        const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
        const sessionAttributes = attributesManager.getSessionAttributes() || {};

        // 清空持久化的购物车和已选配送枠（使用 unified cartData）
        if (persistentAttributes.cartData) {
            delete persistentAttributes.cartData;
            console.log('[ClearCartHandler] Removed persistent cartData');
        }
         attributesManager.setPersistentAttributes(persistentAttributes);
         await attributesManager.savePersistentAttributes();

         // 同步清空当前会话中的购物车和已选配送枠
         delete sessionAttributes.cart;
         delete sessionAttributes.cartDelivery;
         attributesManager.setSessionAttributes(sessionAttributes);

        const speakOutput = 'ご注文をキャンセルしました。またのご利用をお待ちしております。';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
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
        AfterAddDecisionHandler,
        SelectDeliverySlotIntentHandler,
        ChooseDeliverySlotIntentHandler,
        ClearCartHandler,
        IntentReflectorHandler)
    .addRequestInterceptors(LoadCartInterceptor)
    .addResponseInterceptors(SaveCartInterceptor)
    .addErrorHandlers(ErrorHandler)
    .withPersistenceAdapter(getPersistenceAdapter())
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();