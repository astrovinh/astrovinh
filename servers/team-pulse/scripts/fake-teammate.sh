#!/usr/bin/env bash
# Joins a team as a second member and sends a heartbeat every 60 s, so one Mac can see two people.
# Usage: fake-teammate.sh <server> <join code> <name>
set -euo pipefail
SERVER="$1"; CODE="$2"; NAME="$3"
TEAM="${CODE%%.*}"; SECRET="${CODE##*.}"
KEY=$(curl -fsS -X POST "$SERVER/teams/$TEAM/join" -H 'content-type: application/json' \
  -d "{\"code\":\"$SECRET\",\"name\":\"$NAME\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["key"])')
SID="fake$(date +%s)"
echo "Joined as $NAME. Ctrl-C to stop."
while true; do
  NOW=$(python3 -c 'import time; print(int(time.time()*1000))')
  curl -fsS -X PUT "$SERVER/teams/$TEAM/sessions/$SID" -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
    -d "{\"session\":\"$SID\",\"project\":\"mobile-app\",\"branch\":\"fix/paywall-restore\",\"line\":\"Fixing purchase restore on iOS\",\"state\":\"working\",\"fiveHour\":64,\"week\":41,\"startedAt\":$NOW}" >/dev/null
  sleep 60
done
