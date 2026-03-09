const { Queue } = require('bullmq');
const { redis: connection } = require('../config/redis');
const logger = require('./logger');

// Create the unified Email Queue processor
const emailQueue = new Queue('EmailDeliveryQueue', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
    }
});

/**
 * Enqueues an email for asynchronous background delivery
 * @param {Object} mailOptions 
 */
const enqueueEmail = async (mailOptions) => {
    try {
        await emailQueue.add('sendEmail', mailOptions);
        logger.info(`📧 Email queued for delivery to: ${mailOptions.to}`);
    } catch (err) {
        logger.error(`❌ Failed to queue email to ${mailOptions.to}:`, err);
    }
};

module.exports = {
    emailQueue,
    enqueueEmail
};
