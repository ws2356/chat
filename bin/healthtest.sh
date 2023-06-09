#!/usr/bin/env bash
set -eu

declare -r url=${url:-http://localhost:8030}

respText=$(curl "${url}/health")
if [ "$respText" = 'success' ] ; then
  echo "Health check response ok"
  exit 0
else
  echo "Failed to get health check response."
  exit 1
fi
