const testQueue = require('./queue');

console.log('Test worker started');

testQueue.process(async (job) => {
    console.log(`Starting job ${job.id}`);
    
    try {
        let counter = 0;
        const startTime = Date.now();
        const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds

        while (Date.now() - startTime < twoMinutes) {
            counter++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            console.log(`Job ${job.id}: ${counter} seconds elapsed`);
        }

        console.log(`Job ${job.id} completed after ${counter} seconds`);
        return { seconds: counter };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});