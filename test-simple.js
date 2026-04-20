// Simple test to verify Discord webhook works
const { RedditHireNotifier } = require('./dist/index.js');

async function test() {
  const config = {
    subreddits: ['javascript'], // Single subreddit
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    keywords: ['job', 'hire', 'developer'],
    pollIntervalMs: 30000,
  };

  if (!config.discordWebhookUrl) {
    console.log('Discord webhook URL not found in environment');
    return;
  }

  const notifier = new (RedditHireNotifier.default || RedditHireNotifier)(
    config
  );

  try {
    console.log('Testing single run...');
    await notifier.runOnce();
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

test();
