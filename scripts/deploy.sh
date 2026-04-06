#!/bin/bash
# Zero-downtime deploy for DayBite on the production server.
# Usage: bash scripts/deploy.sh
set -euo pipefail

APP_DIR="/home/pop/daybite-bot"
PM2_APP="popfit2"

echo "🚀 Starting DayBite deploy..."

cd "$APP_DIR"

echo "📥 Pulling latest code..."
git pull

echo "📦 Installing dependencies..."
npm install --omit=dev

echo "♻️  Reloading PM2 app: $PM2_APP (zero downtime)..."
pm2 reload "$PM2_APP"

echo "✅ Deploy complete — $(date '+%Y-%m-%d %H:%M:%S')"
