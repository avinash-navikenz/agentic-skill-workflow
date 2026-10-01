#!/usr/bin/env bash
#
# navi-delivery installer.
#
# Installs the *generated Claude Code adapter* — adapters/claude-code/ — into your
# Claude directory. That tree is the one with the flat layout Claude Code loads:
# skills/<name>/SKILL.md and agents/<name>.md, with the discipline folder folded
# away. The repository root also carries a .claude-plugin/plugin.json, but its
# skills are nested one level deeper (skills/<discipline>/<name>/SKILL.md); that
# nesting is how the source is organised and it is not verified to load.
#
# Usage:
#   ./install.sh                 interactive; symlinks
#   ./install.sh --yes           no prompt (CI)
#   ./install.sh --copy          copy files instead of symlinking
#   ./install.sh --uninstall     remove what this script installed
#   ./install.sh --help
#
# Environment:
#   CLAUDE_SKILLS_DIR   default $HOME/.claude/skills
#   CLAUDE_AGENTS_DIR   default $HOME/.claude/agents
#
# Portability: POSIX-compatible constructs only. No `sed -i`, no `readlink -f`,
# no `realpath`, no `mapfile`, no GNU-only flags — this runs on macOS and on the
# Linux runner CI uses.

set -eu

ASSUME_YES=0
MODE=symlink
ACTION=install

usage() {
  sed -n '3,26p' "$0" | sed 's/^#\{1,2\} \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --yes|-y)    ASSUME_YES=1 ;;
    --copy)      MODE=copy ;;
    --uninstall) ACTION=uninstall ;;
    --help|-h)   usage; exit 0 ;;
    *)           printf 'unknown option: %s (try --help)\n' "$arg" >&2; exit 2 ;;
  esac
done

# Resolve the repository root from this script's own location, so the installer
# works from any working directory. `cd -P` resolves symlinks in the path
# without needing `readlink -f`, which BSD does not have.
SCRIPT_DIR=$(cd -P "$(dirname "$0")" && pwd)
ADAPTER="$SCRIPT_DIR/adapters/claude-code"

SKILLS_SRC="$ADAPTER/skills"
AGENTS_SRC="$ADAPTER/agents"

if [ ! -d "$SKILLS_SRC" ] || [ ! -d "$AGENTS_SRC" ]; then
  printf 'error: %s is missing skills/ or agents/.\n' "$ADAPTER" >&2
  printf 'Regenerate it with: python3 scripts/build_adapters.py .\n' >&2
  exit 1
fi

SKILLS_DST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
AGENTS_DST="${CLAUDE_AGENTS_DIR:-$HOME/.claude/agents}"

skill_count=0
for d in "$SKILLS_SRC"/navi-skill-*; do
  [ -d "$d" ] && skill_count=$((skill_count + 1))
done
agent_count=0
for f in "$AGENTS_SRC"/navi-agent-*.md; do
  [ -f "$f" ] && agent_count=$((agent_count + 1))
done

if [ "$ACTION" = uninstall ]; then
  printf 'navi-delivery uninstaller\n'
  printf '  skills <- %s\n' "$SKILLS_DST"
  printf '  agents <- %s\n' "$AGENTS_DST"
else
  printf 'navi-delivery installer (%s)\n' "$MODE"
  printf '  %s skills -> %s\n' "$skill_count" "$SKILLS_DST"
  printf '  %s agents -> %s\n' "$agent_count" "$AGENTS_DST"
fi

if [ "$ASSUME_YES" -ne 1 ]; then
  printf 'Proceed? [y/N] '
  read -r answer || answer=n
  case "$answer" in
    y|Y|yes|Yes) ;;
    *) printf 'aborted\n'; exit 1 ;;
  esac
fi

if [ "$ACTION" = uninstall ]; then
  removed=0
  for d in "$SKILLS_SRC"/navi-skill-*; do
    [ -d "$d" ] || continue
    target="$SKILLS_DST/$(basename "$d")"
    if [ -e "$target" ] || [ -L "$target" ]; then rm -rf "$target"; removed=$((removed + 1)); fi
  done
  for f in "$AGENTS_SRC"/navi-agent-*.md; do
    [ -f "$f" ] || continue
    target="$AGENTS_DST/$(basename "$f")"
    if [ -e "$target" ] || [ -L "$target" ]; then rm -f "$target"; removed=$((removed + 1)); fi
  done
  printf 'Removed %s item(s).\n' "$removed"
  exit 0
fi

mkdir -p "$SKILLS_DST" "$AGENTS_DST"

# Replace rather than update: `ln -sfn` behaves differently across BSD and GNU
# when the target is an existing directory, and `cp -r` into an existing
# directory nests instead of replacing. Removing first makes both modes
# idempotent on every platform.
install_one() {
  src=$1
  dst=$2
  rm -rf "$dst"
  if [ "$MODE" = copy ]; then
    cp -R "$src" "$dst"
  else
    ln -s "$src" "$dst"
  fi
}

for d in "$SKILLS_SRC"/navi-skill-*; do
  [ -d "$d" ] || continue
  install_one "$d" "$SKILLS_DST/$(basename "$d")"
done

for f in "$AGENTS_SRC"/navi-agent-*.md; do
  [ -f "$f" ] || continue
  install_one "$f" "$AGENTS_DST/$(basename "$f")"
done

printf 'Installed %s skill(s) and %s agent(s).\n' "$skill_count" "$agent_count"
printf '\nNext:\n'
printf '  cd /path/to/your-repo\n'
printf '  node %s/cli/index.js init\n' "$SCRIPT_DIR"
