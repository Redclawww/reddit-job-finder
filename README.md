# Reddit Hire Notifier

A production-ready TypeScript application that scrapes Reddit for hiring posts and sends Discord or Telegram notifications when matching opportunities are found.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Reddit API    │◄───│   Scraper    │────│  HTTP Client    │
│  (old.reddit)   │    │              │    │ (retry/backoff) │
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │
                              ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│     Store       │◄───│   Matcher    │───►│  Gemini API     │
│ (memory/sqlite) │    │ (keywords+AI)│    │ (optional)      │
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │
                              ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Discord       │◄───│   Notifier   │    │    Metrics      │
│   Webhook       │    │              │    │   (Prometheus)  │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

### Core Components

- **Scraper**: Fetches and parses Reddit HTML from old.reddit.com
- **Matcher**: Two-pass filtering (keywords + optional AI scoring via hosted Gemma 4)
- **Notifier**: Sends formatted Discord and Telegram notifications with rate limiting
- **Store**: Tracks seen posts to avoid duplicates (memory/SQLite/MongoDB)
- **HTTP Client**: Robust HTTP handling with retries, backoff, and rate limiting

## 🚀 Quick Start

### Prerequisites

- Node.js 20.18.1+ (Node 22 LTS recommended)
- NPM or Yarn
- Discord webhook URL or Telegram bot credentials

### Installation

```bash
# Clone and install
git clone <repository-url>
cd reddit-hire-notifier
npm ci

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### Basic Usage

```bash
# Development mode with hot reload
npm run dev

# Single scrape (no polling)
npm run start -- --once

# Production build and run
npm run build
npm start

# Run with Docker
docker-compose up -d
```

## ⚙️ Configuration

### Environment Variables

| Variable              | Default                  | Description                                      |
| --------------------- | ------------------------ | ------------------------------------------------ |
| `NODE_ENV`            | `development`            | Environment mode                                 |
| `STORE_TYPE`          | `sqlite`                 | Storage backend (`memory`, `sqlite`, `mongodb`)  |
| `SQLITE_PATH`         | `./data/seen_posts.db`   | SQLite database path                             |
| `MONGODB_URI`         | -                        | MongoDB connection string                        |
| `DISCORD_WEBHOOK_URL` | -                        | **Required**: Discord webhook URL                |
| `GEMINI_API_KEY`      | -                        | **Optional**: Google AI Studio API key for Gemma 4 |
| `GEMINI_MODEL`        | `gemma-4-26b-a4b-it`     | Hosted Gemma 4 model ID                          |
| `GEMINI_THRESHOLD`    | `0.7`                    | AI confidence threshold (0.0-1.0)                |
| `TELEGRAM_BOT_TOKEN`  | -                        | Telegram bot token                               |
| `TELEGRAM_CHAT_ID`    | -                        | Telegram channel or chat ID                      |
| `POLL_INTERVAL_MS`    | `15000`                  | Polling interval (15 seconds minimum)            |
| `USER_AGENT`          | Auto-generated           | HTTP User-Agent string                           |
| `HTTP_PROXY`          | -                        | HTTP proxy URL                                   |
| `MAX_RETRIES`         | `3`                      | HTTP retry attempts                              |
| `PORT`                | `3000`                   | Metrics server port                              |
| `LOG_LEVEL`           | `info`                   | Logging level (`debug`, `info`, `warn`, `error`) |

### Subreddits and Keywords

Edit `src/config/defaults.ts` or use environment variables:

```typescript
{
  "subreddits": ["forhire", "freelance", "remotejs", "jobs"],
  "keywords": [
    "hiring", "hire", "looking for", "freelance", "contract",
    "remote", "developer", "engineer", "next.js", "react"
  ],
  "regexPatterns": [
    "looking\\s+for\\s+.*(dev|developer|engineer)",
    "(hiring|seeking)\\s+.*(dev|developer|engineer)"
  ]
}
```

## 🤖 AI Enhancement

### Hosted Gemma 4

Enable intelligent post scoring with Google's hosted Gemma 4 model on the Gemini API:

```bash
# Set API key
export GEMINI_API_KEY="your_api_key_here"

# Hosted Gemma 4 model from Google AI Studio / Gemini API docs
export GEMINI_MODEL="gemma-4-26b-a4b-it"

# Adjust confidence threshold (0.0 = accept all, 1.0 = very strict)
export GEMINI_THRESHOLD="0.7"
```

**How AI Enhancement Works:**

1. Keywords find potential matches (fast)
2. AI scores each candidate (0.0-1.0)
3. Only posts above threshold trigger notifications

**Why use hosted Gemma 4:**

- Uses Google's current Gemma 4 family through the Gemini API
- No local Ollama runtime or model download required
- Keeps the existing keyword-first, AI-second filtering flow

**Benefits:**

- Reduces false positives from keyword matching
- Understands context and legitimacy
- Filters out spam and low-quality posts

**Tradeoffs:**

- Adds latency per post
- Consumes Gemini API quota

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Metrics (Prometheus format)

```bash
curl http://localhost:3000/metrics
```

### Available Metrics

- `reddit_scrapes_total`: Total scrape cycles
- `reddit_matches_total`: Total matching posts
- `reddit_notifications_total`: Total notifications sent
- `reddit_errors_total`: Total errors encountered
- `reddit_last_scrape_timestamp`: Last successful scrape time

### Monitoring Stack

Run with Prometheus and Grafana:

```bash
docker-compose --profile monitoring up -d
```

Access:

- Grafana: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090

## 🐳 Docker Deployment

### Single Container

```bash
# Build
docker build -t reddit-hire-notifier .

# Run with environment file
docker run -d \
  --name reddit-notifier \
  --env-file .env \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  reddit-hire-notifier
```

### Docker Compose

```bash
# Basic setup
docker-compose up -d

# With monitoring
docker-compose --profile monitoring up -d

# View logs
docker-compose logs -f reddit-notifier
```

## 🔧 Development

### Scripts

```bash
npm run dev          # Development with hot reload
npm run build        # Production build
npm run test         # Run tests
npm run test:watch   # Watch mode testing
npm run test:coverage # Coverage report
npm run lint         # ESLint
npm run lint:fix     # Fix linting issues
npm run format       # Prettier formatting
npm run typecheck    # TypeScript type checking
```

### Testing

```bash
# Unit tests
npm test

# Integration tests with Redis/MongoDB
npm run test:integration

# Coverage report
npm run test:coverage
open coverage/lcov-report/index.html
```

### Adding New Stores

Implement the `IStore` interface:

```typescript
import { IStore } from './types/interfaces';

export class MyStore implements IStore {
  async hasSeen(postId: string): Promise<boolean> {
    // Implementation
  }

  async markSeen(postId: string): Promise<void> {
    // Implementation
  }

  async cleanup?(): Promise<void> {
    // Optional cleanup
  }
}
```

## 📋 Production Deployment

### Systemd Service

Create `/etc/systemd/system/reddit-notifier.service`:

```ini
[Unit]
Description=Reddit Hire Notifier
After=network.target

[Service]
Type=simple
User=reddit-notifier
WorkingDirectory=/opt/reddit-hire-notifier
Environment=NODE_ENV=production
EnvironmentFile=/opt/reddit-hire-notifier/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable reddit-notifier
sudo systemctl start reddit-notifier
sudo systemctl status reddit-notifier
```

### Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name reddit-notifier

# Save configuration
pm2 save
pm2 startup
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reddit-hire-notifier
spec:
  replicas: 1
  selector:
    matchLabels:
      app: reddit-hire-notifier
  template:
    metadata:
      labels:
        app: reddit-hire-notifier
    spec:
      containers:
        - name: app
          image: reddit-hire-notifier:latest
          ports:
            - containerPort: 3000
          env:
            - name: DISCORD_WEBHOOK_URL
              valueFrom:
                secretKeyRef:
                  name: reddit-secrets
                  key: discord-webhook-url
          volumeMounts:
            - name: data
              mountPath: /app/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: reddit-notifier-data
```

## ⚠️ Legal and Ethical Considerations

### Rate Limiting

- **Default: 15 seconds** between requests
- **Minimum: 1 second** (configurable but not recommended)
- **Recommendation: 30+ seconds** for production

### Robots.txt Compliance

- Automatically checks `/robots.txt`
- Logs warnings if crawling is disallowed
- Respects `Crawl-delay` directives

### Best Practices

1. **Use descriptive User-Agent** with contact info
2. **Monitor resource usage** and error rates
3. **Implement exponential backoff** on failures
4. **Don't overwhelm Reddit's servers**
5. **Respect community guidelines**

### Legal Notes

- Web scraping may be subject to terms of service
- Check Reddit's ToS and robot.txt
- Consider using official Reddit API for production
- Be mindful of copyright and data protection laws

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Maintain test coverage >90%
- Use conventional commits
- Update documentation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**Rate Limited by Reddit**

```bash
# Increase poll interval
export POLL_INTERVAL_MS=30000
```

**Discord Webhook 429 Errors**

```bash
# Check webhook rate limits (30 requests/minute)
# The app automatically queues and throttles requests
```

**SQLite Permission Errors**

```bash
# Ensure data directory is writable
mkdir -p ./data
chmod 755 ./data
```

**Memory Usage Growing**

```bash
# Switch from memory to SQLite store
export STORE_TYPE=sqlite
```

### Debug Mode

```bash
export LOG_LEVEL=debug
export LOG_PRETTY=true
npm run dev
```

### Health Checks

```bash
# Application health
curl http://localhost:3000/health

# Database connectivity (SQLite)
ls -la ./data/seen_posts.db

# Discord webhook test
curl -X POST $DISCORD_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

---

**Built with ❤️ using TypeScript, Node.js, and modern DevOps practices.**
# reddit-job-finder
