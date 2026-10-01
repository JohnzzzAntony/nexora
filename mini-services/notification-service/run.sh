#!/bin/bash
cd "$(dirname "$0")"
while true; do
  echo "Starting notification service..."
  bun index.ts
  echo "Service exited, restarting in 2s..."
  sleep 2
done
