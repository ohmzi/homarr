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
ROLLBACK_IMAGE=homarr:previous
NAME=homarr
APPDATA=/data/compose/5/homarr/appdata
ENV_FILE=/home/ohmz/.config/homarr/homarr.env
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ -r "$ENV_FILE" ] || { echo "FATAL: $ENV_FILE missing/unreadable" >&2; exit 1; }

# Restore the image preserved by the last --build, so a bad deploy can be undone.
# Restore the database separately from your own backup; this only swaps the image.
if [ "${1:-}" = "--rollback" ]; then
  docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1 || {
    echo "FATAL: no $ROLLBACK_IMAGE image to roll back to" >&2; exit 1; }
  echo "==> retagging $ROLLBACK_IMAGE as $IMAGE"
  docker tag "$ROLLBACK_IMAGE" "$IMAGE"
fi

if [ "${1:-}" = "--build" ]; then
  if [ -n "$(git -C "$REPO" status --porcelain)" ]; then
    echo "WARNING: working tree is dirty - the build will ship uncommitted changes:" >&2
    git -C "$REPO" status --porcelain >&2
    read -rp "Continue? [y/N] " a; [ "$a" = "y" ] || exit 1
  fi
  # Preserve the image we are about to replace. `docker build -t $IMAGE` retags in
  # place and leaves the previous image dangling, so without this a rollback would
  # silently redeploy the new build.
  if docker image inspect "$IMAGE" >/dev/null 2>&1; then
    docker tag "$IMAGE" "$ROLLBACK_IMAGE"
    echo "==> previous image kept as $ROLLBACK_IMAGE (rollback: ./deploy-homarr.sh --rollback)"
  fi
  REV="$(git -C "$REPO" rev-parse HEAD)"
  [ -n "$(git -C "$REPO" status --porcelain)" ] && REV="$REV-dirty"
  echo "==> building $IMAGE ($REV)"
  docker build --label org.homarr.dev.source="$REPO" \
               --label org.homarr.dev.revision="$REV" \
               -t "$IMAGE" "$REPO"
fi

# Back up the sqlite DB before replacing the container. This must fail loudly: the
# backup is the only thing standing between a bad migration and the user's data, so a
# silent partial copy is worse than not deploying. Include the -journal/-wal sidecars
# so a torn copy is at least recoverable.
if [ -d "$APPDATA/db" ]; then
  BK="$APPDATA/db/backup-$(date +%Y%m%d-%H%M%S)"
  sudo mkdir -p "$BK" || { echo "FATAL: cannot create backup dir $BK" >&2; exit 1; }
  if ! sudo sh -c "cp -a '$APPDATA'/db/*.sqlite* '$BK'/"; then
    echo "FATAL: db backup copy failed; not deploying" >&2; exit 1
  fi
  if [ -z "$(sudo ls -A "$BK" 2>/dev/null)" ]; then
    echo "FATAL: db backup dir $BK is empty; not deploying" >&2; exit 1
  fi
  if ! sudo test -s "$BK/db.sqlite"; then
    echo "FATAL: $BK/db.sqlite missing or empty; not deploying" >&2; exit 1
  fi
  echo "==> db backed up to $BK ($(sudo find "$BK" -type f | wc -l) file(s))"
fi

# One-time repair for the v1-fork -> v2 upgrade, run before the new image starts.
#
# Drizzle applies migrations by timestamp watermark, not by index: it runs every journal
# entry whose `when` exceeds the largest recorded created_at. This fork's
# 0042_regular_dragon_lord is stamped 1789615820333 - later than every v2 migration - so
# v2's own 0042-0047 would be SKIPPED and the instance would start with missing tables
# (the seed then dies with "no such table: custom_widget_v2_definition"). Back-dating
# that single recorded row puts the watermark one millisecond below v2's 0042 so the
# whole chain applies. Repeat runs are a no-op once the row is gone.
REPAIR_WATERMARK=$(cat <<'PY'
import sqlite3, sys
legacy, target = 1789615820333, 1784305283909
con = sqlite3.connect(sys.argv[1])
row = con.execute("select count(*) from __drizzle_migrations where created_at = ?", (legacy,)).fetchone()[0]
if row:
    con.execute("update __drizzle_migrations set created_at = ? where created_at = ?", (target, legacy))
    con.commit()
    if con.execute("select count(*) from __drizzle_migrations where created_at = ?", (legacy,)).fetchone()[0]:
        sys.exit("watermark row still present after update")
    print(f"==> migration watermark repaired ({row} row back-dated)")
else:
    print("==> migration watermark already repaired (nothing to do)")
PY
)
DBFILE="$APPDATA/db/db.sqlite"
if sudo test -f "$DBFILE"; then
  if ! sudo python3 -c "$REPAIR_WATERMARK" "$DBFILE"; then
    echo "FATAL: migration watermark repair failed; not deploying" >&2; exit 1
  fi
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
