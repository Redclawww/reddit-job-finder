# Oracle Cloud Always Free Deployment

This app is best deployed on an Oracle Cloud Always Free VM because it is a long-running scraper with local SQLite storage.

## 1. Create The VM

1. In Oracle Cloud, open **Compute > Instances > Create instance**.
2. Use an Ubuntu image, preferably **Ubuntu 22.04** or **Ubuntu 24.04**.
3. For the free shape, use either:
   - **VM.Standard.A1.Flex** with 1 OCPU and 6 GB RAM, if available.
   - **VM.Standard.E2.1.Micro**, if A1 capacity is unavailable.
4. Add your SSH public key.
5. Keep the default VCN settings.
6. Create the instance.

You do not need to open HTTP ports for this bot. It only needs outbound internet to Reddit, Discord, and NVIDIA.

## 2. SSH Into The VM

From your local machine:

```bash
ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
```

If Oracle gave you a private key file:

```bash
chmod 600 oracle-key.pem
ssh -i oracle-key.pem ubuntu@YOUR_ORACLE_PUBLIC_IP
```

## 3. Install Docker

Run this on the VM:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

Check Docker:

```bash
docker --version
docker compose version
```

## 4. Put The Code On The VM

If the repo is on GitHub:

```bash
git clone YOUR_REPO_URL reddit-scraper
cd reddit-scraper
```

If it is not on GitHub yet, upload it from your local machine:

```bash
scp -r /home/raghav-sharma/reddit-scraper ubuntu@YOUR_ORACLE_PUBLIC_IP:~/reddit-scraper
ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
cd reddit-scraper
```

## 5. Create Production Env

```bash
cp .env.oracle.example .env
nano .env
```

Set these values:

```bash
DISCORD_WEBHOOK_URL=your_real_discord_webhook
NVIDIA_API_KEY=your_real_nvidia_key
REDDIT_USER_AGENT=reddit-hire-notifier/1.0 by your_reddit_username
```

Keep the database path as:

```bash
DATABASE_PATH=/app/data/reddit-hire-notifier.sqlite
```

## 6. Start The Bot

```bash
mkdir -p data
docker compose up -d --build
```

Check status:

```bash
docker compose ps
docker compose logs -f reddit-notifier
```

You should see lines like:

```text
[app] Starting Reddit scrape
[app] Fetched ... raw Reddit posts
```

## 7. Common Operations

Update after pulling new code:

```bash
git pull
docker compose up -d --build
```

Restart:

```bash
docker compose restart reddit-notifier
```

Stop:

```bash
docker compose down
```

View recent logs:

```bash
docker compose logs --tail=100 reddit-notifier
```

Back up SQLite data:

```bash
tar -czf reddit-scraper-data-$(date +%F).tar.gz data
```

## 8. Notes

- Do not commit `.env`. It contains secrets.
- The local SQLite database lives in `./data` on the VM and is mounted into the container.
- The default polling interval is 15 minutes: `POLL_INTERVAL_MS=900000`.
- No public inbound port is required unless you later add a dashboard or health endpoint.
