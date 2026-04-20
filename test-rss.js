// Test RSS feed approach
const axios = require('axios');

async function testRSSFeed() {
  try {
    const response = await axios.get(
      'https://www.reddit.com/r/forhire/new/.rss',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        },
      }
    );
    console.log('RSS Feed Success! Status:', response.status);
    console.log('Content type:', response.headers['content-type']);
    console.log('Content length:', response.data.length);
    console.log('First 500 chars:', response.data.substring(0, 500));
  } catch (error) {
    console.error('RSS Feed failed:', error.response?.status, error.message);
  }
}

testRSSFeed();
