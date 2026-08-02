#!/usr/bin/env bash
set -e

echo "=== MetaSwarm Quality & Verification Gate ==="

echo "[1/3] Running ESLint check..."
rtk npm run lint

echo "[2/3] Running Critical Unit Tests..."
rtk npm run test:critical

echo "[3/3] Running Agent Validation Safety Suite..."
rtk npm run validate:agent

echo "=== MetaSwarm Verification Passed Successfully ==="
