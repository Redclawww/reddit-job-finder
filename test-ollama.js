// Test Ollama implementation
require('dotenv').config();

const { RedditHireNotifier } = require('./dist/index.js');

async function testOllama() {
  // Set environment to use Ollama
  process.env.USE_OLLAMA = 'true';
  process.env.OLLAMA_URL = 'http://localhost:11434';
  process.env.OLLAMA_MODEL = 'llama3.2';

  const config = {
    subreddits: ['forhire'], // Test with job-focused subreddit
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    keywords: ['hire', 'job', 'developer', 'engineer', 'programmer'],
    pollIntervalMs: 30000,
    geminiThreshold: 0.7,
  };

  const notifier = new (RedditHireNotifier.default || RedditHireNotifier)(
    config
  );

  try {
    console.log('Testing Ollama implementation...');
    console.log('Make sure Ollama is running: ollama serve');
    console.log('And that llama3.2 model is available: ollama pull llama3.2');
    await notifier.runOnce();
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    // Ensure cleanup
    await notifier.shutdown();
  }
}

testOllama();
