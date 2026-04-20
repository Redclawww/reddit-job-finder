// Test puppeteer implementation with a single subreddit
require('dotenv').config();

const { RedditHireNotifier } = require('./dist/index.js');

async function testPuppeteer() {
  const config = {
    subreddits: ['javascript'], // Single subreddit that should be accessible
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    keywords: ['job', 'hire', 'developer'],
    pollIntervalMs: 30000,
    geminiApiKey: process.env.GEMINI_API_KEY,
  };

  const notifier = new (RedditHireNotifier.default || RedditHireNotifier)(
    config
  );

  try {
    console.log('Testing Puppeteer scraper with single run...');
    await notifier.runOnce();
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    // Ensure cleanup
    await notifier.shutdown();
  }
}

testPuppeteer();
