#!/usr/bin/env bash
# Install (or print) a crontab line for navi-cron.
#
# Printing is the default on purpose: a scheduled job that opens pull requests
# should be something you read before it exists, not something a script added
# while you were reading its output.
set -euo pipefail

SCHEDULE="0 * * * *"
CONFIG=""
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APPLY=0
PUSH=""

usage() {
  cat <<'USAGE'
usage: install-cron.sh --config <file> [--schedule "<cron expression>"] [--repo <path>] [--push] [--apply]

  --config    required; path to a navi-cron config (absolute, or relative to --repo)
  --schedule  default "0 * * * *" — hourly, on the hour
  --repo      default: the repository this script lives in
  --push      put --push in the scheduled command, so it pushes and opens PRs.
              Without it the job stops at a local commit, which is the right
              way to run it for a week before trusting it.
  --apply     actually add the line to your crontab. Without it, the line is
              printed and nothing changes.
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2 ;;
    --schedule) SCHEDULE="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --push) PUSH=" --push"; shift ;;
    --apply) APPLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "install-cron.sh: unknown argument $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$CONFIG" ] || { echo "install-cron.sh: --config is required" >&2; exit 2; }

NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "install-cron.sh: node is not on PATH" >&2; exit 2; }

RUNNER="$REPO/automation/cron/navi-cron.js"
[ -f "$RUNNER" ] || { echo "install-cron.sh: no runner at $RUNNER" >&2; exit 2; }

LOG="$REPO/.navi-cron.log"
# cron runs with a near-empty environment and a PATH that usually lacks node,
# gh, az and jq. Both are named absolutely, and the job sources ~/.navi-cron.env
# if it exists so tracker credentials reach a shell that never read a profile.
LINE="$SCHEDULE cd $REPO || exit 1; [ -f \$HOME/.navi-cron.env ] && . \$HOME/.navi-cron.env; $NODE $RUNNER --config $CONFIG$PUSH >> $LOG 2>&1"

MARK="# navi-cron ($REPO)"

if [ "$APPLY" -eq 0 ]; then
  cat <<EOF
Add this to your crontab (crontab -e), or re-run with --apply:

$MARK
$LINE

Before you do, run it once by hand and read what it says:

  node $RUNNER --config $CONFIG

Credentials: cron does not read your shell profile. Put the tracker variables
in \$HOME/.navi-cron.env (chmod 600) — the line above sources it.
EOF
  exit 0
fi

CURRENT="$(crontab -l 2>/dev/null || true)"
if printf '%s\n' "$CURRENT" | grep -Fq "$MARK"; then
  # Replacing rather than appending: running --apply twice must leave one job,
  # not two jobs opening duplicate pull requests for the same work item.
  printf '%s\n' "$CURRENT" | grep -v -F -e "$MARK" -e "$RUNNER" > /tmp/navi-cron.$$
else
  printf '%s\n' "$CURRENT" > /tmp/navi-cron.$$
fi
{ printf '%s\n%s\n' "$MARK" "$LINE"; } >> /tmp/navi-cron.$$
crontab /tmp/navi-cron.$$
rm -f /tmp/navi-cron.$$
echo "installed. Review it with: crontab -l"
