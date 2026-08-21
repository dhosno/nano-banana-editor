#!/usr/bin/env bash

set -euo pipefail

: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${VALIDATION_IMAGE:?VALIDATION_IMAGE is required}"

archive="$RUNNER_TEMP/validation-source.tar"
rm -f "$archive"
tar \
  --exclude=.factory \
  --exclude=.git \
  --exclude=.next \
  --exclude=node_modules \
  -cf "$archive" \
  -C "$GITHUB_WORKSPACE" \
  .

runner_uid="$(id -u)"
runner_gid="$(id -g)"

for validation_command in "npm run lint" "npm test" "npm run build"; do
  docker run --rm \
    --network none \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --pids-limit 512 \
    --cpus 2 \
    --memory 4g \
    --read-only \
    --tmpfs "/repo:rw,nosuid,nodev,size=4g,uid=$runner_uid,gid=$runner_gid" \
    --tmpfs "/tmp:rw,nosuid,nodev,size=512m,uid=$runner_uid,gid=$runner_gid" \
    --user "$runner_uid:$runner_gid" \
    --env HOME=/tmp \
    --env NEXT_TELEMETRY_DISABLED=1 \
    --env "VALIDATION_COMMAND=$validation_command" \
    --volume "$archive:/input/source.tar:ro" \
    --volume "$GITHUB_WORKSPACE/node_modules:/repo/node_modules:ro" \
    --workdir /repo \
    "$VALIDATION_IMAGE" \
    bash -lc '
      set -euo pipefail
      tar -xf /input/source.tar -C /repo
      bash -lc "$VALIDATION_COMMAND"
    '
done
