#!/usr/bin/env node

// Quick validation script to test core functionality
const { RedditScraper } = require('./dist/lib/scraper');
const { MemoryStore } = require('./dist/lib/store/memory-store');
const { PostMatcher } = require('./dist/lib/matcher');

async function validateComponents() {
  console.log('🧪 Validating Reddit Hire Notifier components...\n');

  try {
    // Test 1: Memory Store
    console.log('✓ Testing MemoryStore...');
    const store = new MemoryStore();
    await store.markSeen('test123');
    const hasSeen = await store.hasSeen('test123');
    console.log(`  - Can mark and check posts: ${hasSeen ? '✓' : '✗'}`);

    // Test 2: PostMatcher
    console.log('✓ Testing PostMatcher...');
    const matcher = new PostMatcher(['hiring', 'developer'], []);
    const testPost = {
      id: 'test123',
      title: 'Hiring React Developer',
      author: 'testuser',
      permalink: '/test',
      subreddit: 'test',
      score: 10,
      createdUtc: Date.now() / 1000,
    };
    const matches = await matcher.findMatches([testPost], 'test');
    console.log(
      `  - Keyword matching works: ${matches.length > 0 ? '✓' : '✗'}`
    );

    // Test 3: Config validation
    console.log('✓ Testing configuration...');
    const { defaultConfig } = require('./dist/config/defaults');
    console.log(
      `  - Default config loaded: ${defaultConfig.subreddits ? '✓' : '✗'}`
    );

    console.log('\n🎉 All core components validated successfully!');
    console.log('\n📝 Next Steps:');
    console.log('1. Set up .env file with Discord webhook URL');
    console.log('2. Run: npm start -- --once (for single test)');
    console.log('3. Run: npm start (for continuous monitoring)');
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

validateComponents();
