#!/usr/bin/env bash
# Builds the backend image for the Orange Pi (linux/arm64), ships only the
# image (no source) to the server, and restarts the container there.
#
# Usage: ./deploy-to-server.sh [host] [remote_dir]
# Defaults match the current home server (see ~/.ssh/config for the
# "orangepi" alias and key-based auth).
set -euo pipefail

REMOTE="${1:-orangepi}"
REMOTE_DIR="${2:-/home/orangepi/quantis/Quantis-Backend}"
IMAGE="quantis-backend-api:latest"
TARBALL="quantis-backend-api.tar.gz"

echo "==> Building $IMAGE for linux/arm64"
DOCKER_DEFAULT_PLATFORM=linux/arm64 docker compose build api

echo "==> Saving image to $TARBALL"
docker save "$IMAGE" | gzip > "$TARBALL"

echo "==> Copying image to $REMOTE"
scp "$TARBALL" "$REMOTE:/tmp/$TARBALL"

echo "==> Loading image and restarting container on $REMOTE"
ssh "$REMOTE" "docker load -i /tmp/$TARBALL && rm -f /tmp/$TARBALL && cd '$REMOTE_DIR' && docker compose up -d api"

echo "==> Cleaning up local tarball"
rm -f "$TARBALL"

echo "==> Done. The API container was updated without touching its source tree."
