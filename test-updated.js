// Test the updated Gemini implementation and rate limiting
require('dotenv').config();

const { RedditHireNotifier } = require('./dist/index.js');

async function testUpdatedImplementation() {
  const config = {
    subreddits: ['forhire'], // Test with job-focused subreddit
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    keywords: ['hire', 'job', 'developer', 'engineer', 'programmer'],
    pollIntervalMs: 30000,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiThreshold: 0.7,
  };

  const notifier = new (RedditHireNotifier.default || RedditHireNotifier)(
    config
  );

  try {
    console.log(
      'Testing updated implementation with Gemini and rate limiting...'
    );
    await notifier.runOnce();
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    // Ensure cleanup
    await notifier.shutdown();
  }
}

testUpdatedImplementation();
