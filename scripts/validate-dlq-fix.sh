#!/bin/bash
# Validation script for Telegram notification fixes
# Usage: ./scripts/validate-dlq-fix.sh

set -e

echo "=== DLQ Constraint Check ==="
psql "$DATABASE_URL" -c "SELECT conname, contype FROM pg_constraint WHERE conname = 'uq_failed_notification_queue_correlation_id';"

echo ""
echo "=== DLQ Table Status ==="
psql "$DATABASE_URL" -c "SELECT status, COUNT(*) as count FROM failed_notification_queue GROUP BY status ORDER BY status;"

echo ""
echo "=== Recent DLQ Entries ==="
psql "$DATABASE_URL" -c "SELECT id, correlation_id, notification_type, status, created_at FROM failed_notification_queue ORDER BY created_at DESC LIMIT 5;"

echo ""
echo "=== Vercel Logs (last 10 min) ==="
vercel logs --mode=production --since=10m 2>/dev/null | grep -i "error\|failed\|parse\|dead\|letter" | head -20 || echo "No logs found or vercel CLI not configured"
