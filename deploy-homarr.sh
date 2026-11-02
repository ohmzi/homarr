#!/usr/bin/env bash
# Hardened deploy for the local homarr fork.
#
# WHY THIS EXISTS: homarr was previously deployed by hand-typed `docker build` +
# `docker run` commands. That recipe mounted /var/run/docker.sock read-write and set
# no security options, so every rebuild silently re-granted homarr root-equivalent
# control of the Docker daemon. This script is the deploy path; use it instead.
#
#   ./deploy-homarr.sh            # re-run the container from the existing image
#   ./deploy-homarr.sh --build    # rebuild the image first, then run
#
set -euo pipefail

IMAGE=homarr:develop
NAME=homarr
APPDATA=/data/compose/5/homarr/appdata
ENV_FILE=/home/ohmz/.config/homarr/homarr.env
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ -r "$ENV_FILE" ] || { echo "FATAL: $ENV_FILE missing/unreadable" >&2; exit 1; }

if [ "${1:-}" = "--build" ]; then
  if [ -n "$(git -C "$REPO" status --porcelain)" ]; then
    echo "WARNING: working tree is dirty - the build will ship uncommitted changes:" >&2
    git -C "$REPO" status --porcelain >&2
    read -rp "Continue? [y/N] " a; [ "$a" = "y" ] || exit 1
  fi
  REV="$(git -C "$REPO" rev-parse HEAD)"
  [ -n "$(git -C "$REPO" status --porcelain)" ] && REV="$REV-dirty"
  echo "==> building $IMAGE ($REV)"
  docker build --label org.homarr.dev.source="$REPO" \
               --label org.homarr.dev.revision="$REV" \
               -t "$IMAGE" "$REPO"
fi

# Back up the sqlite DB before replacing the container.
if [ -d "$APPDATA/db" ]; then
  BK="$APPDATA/db/backup-$(date +%Y%m%d-%H%M%S)"
  sudo mkdir -p "$BK"
  sudo sh -c "cp -a '$APPDATA'/db/*.sqlite* '$BK'/ 2>/dev/null" || true
  echo "==> db backed up to $BK"
fi

echo "==> replacing container"
docker rm -f "$NAME" >/dev/null 2>&1 || true

# network=host is REQUIRED: nginx inside the image listens on 7575 and proxies to
# 3000/3001. Do not convert this to a bridge with -p.
#
# NOTE: deliberately NO `-v /var/run/docker.sock:...`. DOCKER_HOST in the env file
# points dockerode at the read-only socket proxy on 127.0.0.1:2375, which permits
# GET /containers only. Homarr's start/stop/restart buttons will return 403 by design.
docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  --network host \
  --security-opt no-new-privileges:true \
  --env-file "$ENV_FILE" \
  -v "$APPDATA":/appdata \
  "$IMAGE"

echo "==> waiting for homarr to answer on :7575"
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null --max-time 3 http://127.0.0.1:7575/ 2>/dev/null; then
    echo "==> up after ${i}0s"
    # Fail loudly if the hardening did not stick.
    docker inspect -f '{{range .Mounts}}{{.Source}} {{end}}' "$NAME" | grep -q docker.sock \
      && { echo "FATAL: docker.sock got mounted - hardening failed" >&2; exit 1; }
    docker inspect -f '{{.HostConfig.SecurityOpt}}' "$NAME" | grep -q no-new-privileges \
      || { echo "FATAL: no-new-privileges missing" >&2; exit 1; }
    echo "==> OK: no docker.sock, no-new-privileges set, DOCKER_HOST -> proxy"
    exit 0
  fi
  sleep 3
done
echo "FATAL: homarr did not come up within 180s" >&2
docker logs --tail 30 "$NAME" >&2 || true
exit 1
