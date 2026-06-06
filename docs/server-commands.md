# Server Commands

Server: `80.225.192.108`
User: `ubuntu`
App directory: `/home/ubuntu/reddit-scraper`
Local SSH key: `~/Downloads/ssh-key-2026-05-16.key`

## SSH

```bash
ssh -i ~/Downloads/ssh-key-2026-05-16.key ubuntu@80.225.192.108
```

## Go To App Directory

Run after SSH:

```bash
cd ~/reddit-scraper
```

## Check Status

```bash
sudo docker compose ps
```

## Watch Logs

```bash
sudo docker compose logs -f reddit-notifier
```

## Last Logs

```bash
sudo docker compose logs --tail=100 reddit-notifier
```

## Restart Bot

```bash
cd ~/reddit-scraper
sudo docker compose restart reddit-notifier
```

## Stop Bot

```bash
cd ~/reddit-scraper
sudo docker compose down
```

## Start Bot

```bash
cd ~/reddit-scraper
sudo docker compose up -d
```

## Rebuild And Start

Use this after code changes are already on the server:

```bash
cd ~/reddit-scraper
sudo docker compose up -d --build
```

## Sync Local Code To Server

Run from your local machine:

```bash
rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'coverage/' \
  --exclude '.cache/' \
  --exclude 'data/' \
  --exclude '.env' \
  -e "ssh -i ~/Downloads/ssh-key-2026-05-16.key -o StrictHostKeyChecking=accept-new" \
  ~/reddit-scraper/ ubuntu@80.225.192.108:/home/ubuntu/reddit-scraper/
```

If your local repo path is different, replace `~/reddit-scraper/` with the actual local path.

## Sync Current Local Repo To Server

This is the command for this machine:

```bash
rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'coverage/' \
  --exclude '.cache/' \
  --exclude 'data/' \
  --exclude '.env' \
  -e "ssh -i ~/Downloads/ssh-key-2026-05-16.key -o StrictHostKeyChecking=accept-new" \
  /home/raghav-sharma/reddit-scraper/ ubuntu@80.225.192.108:/home/ubuntu/reddit-scraper/
```

Then rebuild on server:

```bash
ssh -i ~/Downloads/ssh-key-2026-05-16.key ubuntu@80.225.192.108 \
  'cd ~/reddit-scraper && sudo docker compose up -d --build'
```

## Edit Env

```bash
cd ~/reddit-scraper
nano .env
sudo docker compose restart reddit-notifier
```

## Backup Data

```bash
cd ~/reddit-scraper
tar -czf reddit-scraper-data-$(date +%F).tar.gz data
```

## Download Backup Locally

Run from your local machine:

```bash
scp -i ~/Downloads/ssh-key-2026-05-16.key \
  ubuntu@80.225.192.108:/home/ubuntu/reddit-scraper/reddit-scraper-data-YYYY-MM-DD.tar.gz .
```

Replace `YYYY-MM-DD` with the backup date.

## Server Disk And Memory

```bash
df -h
free -h
```

## Docker Cleanup

Use if disk space gets low:

```bash
sudo docker system prune -f
```

## Current Known Good Check

```bash
cd ~/reddit-scraper
sudo docker compose ps
sudo docker compose logs --tail=20 reddit-notifier
```

Expected recent logs look like:

```text
[app] Starting Reddit scrape
[app] Fetched 300 raw Reddit posts
[app] New leads: ...
[app] Passed heuristic: ...
[app] Notified ...
```
