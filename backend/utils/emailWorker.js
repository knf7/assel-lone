const { Worker } = require('bullmq');
const { redis: connection } = require('../config/redis');
const logger = require('./logger');

// We have deferred initialization to prevent circular dependencies
let sendMailFunction = null;

const emailWorker = new Worker('EmailDeliveryQueue', async job => {
    logger.info(`Processing Email Job ${job.id} for ${job.data.to}`);

    if (!sendMailFunction) {
        // Late-bind the Nodemailer transport so it isn't required simultaneously 
        throw new Error('Email Transport Not Initialized in Worker Context');
    }

    await sendMailFunction(job.data);
    logger.info(`Successfully sent email from Job ${job.id}`);

}, { connection });

emailWorker.on('completed', job => {
    logger.debug(`Email Job ${job.id} marked complete.`);
});

emailWorker.on('failed', (job, err) => {
    logger.error(`❌ Email Job ${job.id} failed:`, err);
});

// Inject the transport function from the generic mailer or server root
module.exports = {
    emailWorker,
    bindTransport: (sendFunction) => { sendMailFunction = sendFunction; }
};
