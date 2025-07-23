const config = require('../../config');

async function sendLongMessage(interactionOrMessage, text) {
    let replyFunction;
    let followUpFunction;

    // Determine the initial reply function based on interaction state
    if (interactionOrMessage.deferred || interactionOrMessage.replied) {
        replyFunction = interactionOrMessage.followUp.bind(interactionOrMessage);
        followUpFunction = interactionOrMessage.followUp.bind(interactionOrMessage);
    } else {
        replyFunction = interactionOrMessage.reply.bind(interactionOrMessage);
        // For Interactions, after the first reply, subsequent replies must be followUp.
        // For Messages, there's no followUp, so we'll just use reply for all parts.
        followUpFunction = interactionOrMessage.followUp ? interactionOrMessage.followUp.bind(interactionOrMessage) : interactionOrMessage.reply.bind(interactionOrMessage);
    }

    if (text.length <= config.MAX_MESSAGE_LENGTH) {
        await replyFunction(text);
    } else {
        let currentMessage = '';
        const words = text.split(' ');
        let firstPartSent = false;

        for (const word of words) {
            if (currentMessage.length + word.length + 1 > config.MAX_MESSAGE_LENGTH) {
                if (!firstPartSent) {
                    await replyFunction(currentMessage);
                    firstPartSent = true;
                } else {
                    await followUpFunction(currentMessage);
                }
                currentMessage = word + ' ';
            } else {
                currentMessage += word + ' ';
            }
        }
        if (currentMessage.length > 0) {
            if (!firstPartSent) {
                await replyFunction(currentMessage);
            } else {
                await followUpFunction(currentMessage);
            }
        }
    }
}

module.exports = { sendLongMessage };
