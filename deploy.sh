#!/bin/bash

# Reddit Hire Notifier Deployment Script
set -e

echo "🚀 Deploying Reddit Hire Notifier..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }

# Parse command line arguments
ENVIRONMENT=${1:-production}
DEPLOYMENT_DIR=${2:-/opt/reddit-hire-notifier}

echo "📁 Deployment directory: $DEPLOYMENT_DIR"
echo "🏷️  Environment: $ENVIRONMENT"

# Create deployment directory
sudo mkdir -p $DEPLOYMENT_DIR
sudo chown $USER:$USER $DEPLOYMENT_DIR

# Copy files
echo "📄 Copying application files..."
cp -r . $DEPLOYMENT_DIR/
cd $DEPLOYMENT_DIR

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build application
echo "🔨 Building application..."
npm run build

# Drop dev dependencies after the build completes
echo "🧹 Pruning development dependencies..."
npm prune --omit=dev

# Create data directory
mkdir -p $DEPLOYMENT_DIR/data

# Set up environment file
if [ ! -f "$DEPLOYMENT_DIR/.env" ]; then
    echo "⚙️  Creating environment file..."
    cp .env.example .env
    echo "📝 Please edit $DEPLOYMENT_DIR/.env with your configuration"
fi

# Create systemd service
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔧 Setting up systemd service..."
    
    sudo tee /etc/systemd/system/reddit-notifier.service > /dev/null <<EOF
[Unit]
Description=Reddit Hire Notifier
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$DEPLOYMENT_DIR
Environment=NODE_ENV=production
EnvironmentFile=$DEPLOYMENT_DIR/.env
ExecStart=/usr/bin/node $DEPLOYMENT_DIR/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable reddit-notifier
    
    echo "✅ Systemd service created and enabled"
    echo "▶️  Start with: sudo systemctl start reddit-notifier"
    echo "📊 Status with: sudo systemctl status reddit-notifier"
    echo "📝 Logs with: sudo journalctl -u reddit-notifier -f"
fi

# Set up logrotate
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📋 Setting up log rotation..."
    
    sudo tee /etc/logrotate.d/reddit-notifier > /dev/null <<EOF
/var/log/reddit-notifier/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        systemctl reload reddit-notifier
    endscript
}
EOF
    
    # Create log directory
    sudo mkdir -p /var/log/reddit-notifier
    sudo chown $USER:$USER /var/log/reddit-notifier
fi

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit $DEPLOYMENT_DIR/.env with your Discord webhook URL"
echo "2. Start the service: sudo systemctl start reddit-notifier"
echo "3. Monitor health: curl http://localhost:3000/health"
echo "4. View metrics: curl http://localhost:3000/metrics"
echo ""
echo "📚 Documentation: $DEPLOYMENT_DIR/README.md"
