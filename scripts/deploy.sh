#!/bin/bash
set -e

echo "🚀 DayBite — Deploy Script"
cd /home/pop/daybite-bot

echo "📥 Pulling latest code..."
git pull

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building TypeScript..."
npm run build

echo "🔄 Reloading PM2 (graceful)..."
pm2 reload daybite-bot

echo "✅ Deploy complete!"
pm2 status daybite-bot
