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
#   ./install.sh                 interactive; symlinks everything
#   ./install.sh --agent NAME    that agent and only the skills it holds
#   ./install.sh --skill NAME    that skill on its own
#   ./install.sh --yes           no prompt (CI)
#   ./install.sh --copy          copy files instead of symlinking
#   ./install.sh --uninstall     remove what this script installed
#   ./install.sh --help
#
# --agent and --skill may be repeated and combined; together they install the
# union. An agent brings the skills named under `skills:` in its own file, so
# the pair is usable on its own — an agent without them reaches for files that
# are not there. With no selection, everything is installed.
#
# Environment:
#   CLAUDE_SKILLS_DIR     default $HOME/.claude/skills
#   CLAUDE_AGENTS_DIR     default $HOME/.claude/agents
#   CLAUDE_COMMANDS_DIR   default $HOME/.claude/commands
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

# Newline-separated, because a name never contains whitespace and POSIX sh has
# no arrays. Empty means "no selection made" — install everything.
WANT_AGENTS=
WANT_SKILLS=

need_value() {
  [ "$2" -gt 1 ] || { printf '%s needs a name (try --help)\n' "$1" >&2; exit 2; }
}

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y)    ASSUME_YES=1 ;;
    --copy)      MODE=copy ;;
    --uninstall) ACTION=uninstall ;;
    --help|-h)   usage; exit 0 ;;
    --agent)     need_value "$1" $#; WANT_AGENTS="$WANT_AGENTS
$2"; shift ;;
    --skill)     need_value "$1" $#; WANT_SKILLS="$WANT_SKILLS
$2"; shift ;;
    *)           printf 'unknown option: %s (try --help)\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

# Resolve the repository root from this script's own location, so the installer
# works from any working directory. `cd -P` resolves symlinks in the path
# without needing `readlink -f`, which BSD does not have.
SCRIPT_DIR=$(cd -P "$(dirname "$0")" && pwd)
ADAPTER="$SCRIPT_DIR/adapters/claude-code"

SKILLS_SRC="$ADAPTER/skills"
AGENTS_SRC="$ADAPTER/agents"
# Each agent also ships a slash command, so an agent can be reached the same way
# a skill is. Generated beside the agents; absent only on an adapter built before
# they existed, which is why nothing here requires the directory.
COMMANDS_SRC="$ADAPTER/commands"

if [ ! -d "$SKILLS_SRC" ] || [ ! -d "$AGENTS_SRC" ]; then
  printf 'error: %s is missing skills/ or agents/.\n' "$ADAPTER" >&2
  printf 'Regenerate it with: python3 scripts/build_adapters.py .\n' >&2
  exit 1
fi

SKILLS_DST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
AGENTS_DST="${CLAUDE_AGENTS_DIR:-$HOME/.claude/agents}"
COMMANDS_DST="${CLAUDE_COMMANDS_DIR:-$HOME/.claude/commands}"

# The skills an agent holds are declared in its own file, so a scoped install
# does not need a hard-coded map and cannot fall out of date when a skill moves
# between agents. Stops at the first key that is not a list item.
agent_skills() {
  awk '
    /^skills:[[:space:]]*$/            { inlist = 1; next }
    inlist && /^[[:space:]]*-[[:space:]]*navi-skill-/ {
      sub(/^[[:space:]]*-[[:space:]]*/, ""); sub(/[[:space:]]+$/, ""); print; next
    }
    inlist && /^[^[:space:]]/          { inlist = 0 }
  ' "$1"
}

# Deduplicate while preserving order: two agents sharing a skill must not
# install it twice, and the count printed before the prompt must be the truth.
dedupe() {
  awk 'NF && !seen[$0]++'
}

SEL_AGENTS=
SEL_SKILLS=

if [ -n "$WANT_AGENTS" ] || [ -n "$WANT_SKILLS" ]; then
  for name in $WANT_AGENTS; do
    file="$AGENTS_SRC/$name.md"
    if [ ! -f "$file" ]; then
      printf 'error: no such agent: %s\n' "$name" >&2
      printf 'Available:\n' >&2
      for f in "$AGENTS_SRC"/navi-agent-*.md; do
        [ -f "$f" ] && printf '  %s\n' "$(basename "$f" .md)" >&2
      done
      exit 2
    fi
    SEL_AGENTS="$SEL_AGENTS
$name"
    SEL_SKILLS="$SEL_SKILLS
$(agent_skills "$file")"
  done
  for name in $WANT_SKILLS; do
    if [ ! -d "$SKILLS_SRC/$name" ]; then
      printf 'error: no such skill: %s\n' "$name" >&2
      printf "Run without --skill to see them all, or browse the catalogue.\n" >&2
      exit 2
    fi
    SEL_SKILLS="$SEL_SKILLS
$name"
  done
else
  for d in "$SKILLS_SRC"/navi-skill-*; do
    [ -d "$d" ] && SEL_SKILLS="$SEL_SKILLS
$(basename "$d")"
  done
  for f in "$AGENTS_SRC"/navi-agent-*.md; do
    [ -f "$f" ] && SEL_AGENTS="$SEL_AGENTS
$(basename "$f" .md)"
  done
fi

SEL_AGENTS=$(printf '%s\n' "$SEL_AGENTS" | dedupe)
SEL_SKILLS=$(printf '%s\n' "$SEL_SKILLS" | dedupe)

# A skill an agent names but the adapter does not carry is a build error, not
# something to install around silently.
for name in $SEL_SKILLS; do
  [ -d "$SKILLS_SRC/$name" ] || {
    printf 'error: an agent names skill %s, which is not in %s\n' "$name" "$SKILLS_SRC" >&2
    printf 'Regenerate the adapter with: python3 scripts/build_adapters.py .\n' >&2
    exit 1
  }
done

skill_count=$(printf '%s\n' "$SEL_SKILLS" | awk 'NF' | wc -l | tr -d ' ')
agent_count=$(printf '%s\n' "$SEL_AGENTS" | awk 'NF' | wc -l | tr -d ' ')

if [ "$ACTION" = uninstall ]; then
  printf 'navi-delivery uninstaller\n'
  printf '  skills <- %s\n' "$SKILLS_DST"
  printf '  agents <- %s\n' "$AGENTS_DST"
else
  printf 'navi-delivery installer (%s)\n' "$MODE"
  printf '  %s skills -> %s\n' "$skill_count" "$SKILLS_DST"
  printf '  %s agents -> %s\n' "$agent_count" "$AGENTS_DST"
  # `[ ... ] && printf` would be the last command in its list, so under `set -e`
  # a missing commands/ directory would exit the installer instead of skipping.
  if [ -d "$COMMANDS_SRC" ]; then
    printf '  %s commands -> %s\n' "$agent_count" "$COMMANDS_DST"
  fi
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
  # Skills are shared: most are held by several agents. Removing one agent must
  # not strip skills that another installed agent still loads, or uninstalling
  # the agent you stopped using quietly breaks the one you kept.
  keep=
  for f in "$AGENTS_DST"/navi-agent-*.md; do
    [ -e "$f" ] || continue
    other=$(basename "$f" .md)
    case "
$SEL_AGENTS" in *"
$other") continue ;; *"
$other
"*) continue ;; esac
    [ -f "$AGENTS_SRC/$other.md" ] || continue
    keep="$keep
$(agent_skills "$AGENTS_SRC/$other.md")"
  done

  removed=0
  kept=0
  for name in $SEL_SKILLS; do
    case "
$keep" in *"
$name") kept=$((kept + 1)); continue ;; *"
$name
"*) kept=$((kept + 1)); continue ;; esac
    target="$SKILLS_DST/$name"
    if [ -e "$target" ] || [ -L "$target" ]; then rm -rf "$target"; removed=$((removed + 1)); fi
  done
  for name in $SEL_AGENTS; do
    for target in "$AGENTS_DST/$name.md" "$COMMANDS_DST/$name.md"; do
      if [ -e "$target" ] || [ -L "$target" ]; then rm -f "$target"; removed=$((removed + 1)); fi
    done
  done
  [ "$kept" -gt 0 ] && printf 'Kept %s skill(s) another installed agent still holds.\n' "$kept"
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

for name in $SEL_SKILLS; do
  install_one "$SKILLS_SRC/$name" "$SKILLS_DST/$name"
done

for name in $SEL_AGENTS; do
  install_one "$AGENTS_SRC/$name.md" "$AGENTS_DST/$name.md"
  if [ -f "$COMMANDS_SRC/$name.md" ]; then
    mkdir -p "$COMMANDS_DST"
    install_one "$COMMANDS_SRC/$name.md" "$COMMANDS_DST/$name.md"
  fi
done

if [ -d "$COMMANDS_SRC" ]; then
  printf 'Installed %s skill(s) and %s agent(s), each agent with its slash command.\n' \
    "$skill_count" "$agent_count"
else
  printf 'Installed %s skill(s) and %s agent(s).\n' "$skill_count" "$agent_count"
fi
printf '\nNext:\n'
printf '  cd /path/to/your-repo\n'
printf '  node %s/cli/index.js init\n' "$SCRIPT_DIR"
