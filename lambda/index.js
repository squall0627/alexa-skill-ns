/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');
const { getPersistenceAdapter } = require('./adapters/PersistenceAdapterFactory');

const SearchProductIntentHandler = require('./handlers/SearchProductIntentHandler');
const AddCartIntentHandler = require('./handlers/AddCartIntentHandler');
const AfterAddDecisionHandler = require('./handlers/AfterAddDecisionHandler');

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
            
            // 如果持久化存储中有购物车数据，加载到 session 中
            if (persistentAttributes.cart && persistentAttributes.cart.length > 0) {
                sessionAttributes.cart = persistentAttributes.cart;
                console.log(`[LoadCartInterceptor] Loaded cart with ${persistentAttributes.cart.length} items`);
            }
            
            // 也加载其他重要的持久化属性
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
        console.log('[SaveCartInterceptor] Saving cart data to persistent storage...');
        try {
            const attributesManager = handlerInput.attributesManager;
            const sessionAttributes = attributesManager.getSessionAttributes() || {};
            const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
            
            // 保存购物车数据到持久化存储
            if (sessionAttributes.cart && sessionAttributes.cart.length > 0) {
                persistentAttributes.cart = sessionAttributes.cart;
                console.log(`[SaveCartInterceptor] Saved cart with ${sessionAttributes.cart.length} items`);
            }
            
            // 保存其他会话数据（但不保存临时状态如 lastAction 和 lastAdded）
            if (sessionAttributes.lastSearchResults) {
                persistentAttributes.lastSearchResults = sessionAttributes.lastSearchResults;
            }
            if (sessionAttributes.lastSearchQuery) {
                persistentAttributes.lastSearchQuery = sessionAttributes.lastSearchQuery;
            }
            
            // 设置时间戳用于追踪
            persistentAttributes.lastUpdate = new Date().toISOString();
            
            attributesManager.setPersistentAttributes(persistentAttributes);
            await attributesManager.savePersistentAttributes();
            console.log('[SaveCartInterceptor] Persistent data saved successfully');
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
        
        // 清空购物车
        delete persistentAttributes.cart;
        attributesManager.setPersistentAttributes(persistentAttributes);
        await attributesManager.savePersistentAttributes();
        
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
        ClearCartHandler,
        IntentReflectorHandler)
    .addRequestInterceptors(LoadCartInterceptor)
    .addResponseInterceptors(SaveCartInterceptor)
    .addErrorHandlers(ErrorHandler)
    .withPersistenceAdapter(getPersistenceAdapter())
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();