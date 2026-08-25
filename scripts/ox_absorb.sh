#!/usr/bin/env bash
# Run the upstream v1.28.0 absorption unattended against Ox Alpha on OpenRouter.
#
# Tool config, not product config. Nothing here is imported by the app.
#
# Usage:
#   scripts/ox_absorb.sh                                   # the default prompt
#   OX_PROMPT=.planning/PROMPT-other.md scripts/ox_absorb.sh
#
# The key comes from the environment or from ~/.dsh/.credentials.yaml, and is
# never stored in this repo either way.
#
# Written 2026-08-24. The free Ox Alpha preview ends 2026-08-27.

set -u -o pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH="$HOME/Documents/Dev/itembank/deps/dsh/node_modules/.bin/dsh"
PATCH="$HOME/.dsh/ox-alpha.patch.yml"
PROMPT="$REPO/${OX_PROMPT:-.planning/PROMPT-ox-absorb-v1.28-2026-08-24.md}"
# Outside the tree, so a stray `git add -A` inside the run cannot sweep it in.
LOGDIR="$HOME/.dsh/logs/grimoire"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$LOGDIR/$STAMP-absorb-v1.28.log"

fail() { echo "ox_absorb: $*" >&2; exit 1; }

CREDS="$HOME/.dsh/.credentials.yaml"
if [ -z "${OPENROUTER_API_KEY:-}" ] && [ -f "$CREDS" ]; then
  OPENROUTER_API_KEY="$(sed -n 's/^OPENROUTER_API_KEY:[[:space:]]*//p' "$CREDS" | head -1 | tr -d '"'"'"' \r')"
fi
[ -n "${OPENROUTER_API_KEY:-}" ] || fail "no key. Export OPENROUTER_API_KEY, or put it in $CREDS"
[ -x "$DSH" ] || fail "dsh not installed at $DSH. Run: cd ~/Documents/Dev/itembank/deps/dsh && npm ci"
[ -f "$PATCH" ] || fail "missing $PATCH"
[ -f "$PROMPT" ] || fail "missing $PROMPT"
export OPENROUTER_API_KEY

# Smoke test before committing a long run to it. A bad key, a rate limit and a
# retired preview all look identical from inside one.
echo "ox_absorb: smoke testing stealth/ox-alpha"
SMOKE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"stealth/ox-alpha","max_tokens":8,"messages":[{"role":"user","content":"say ok"}]}')"
case "$SMOKE" in
  200)     echo "ox_absorb: smoke ok" ;;
  401|403) fail "auth rejected (HTTP $SMOKE). Check the key." ;;
  404)     fail "model not found (HTTP $SMOKE). The preview may have ended." ;;
  429)     fail "rate limited (HTTP $SMOKE) on the first request. Do not start a run on this." ;;
  *)       fail "unexpected HTTP $SMOKE from OpenRouter." ;;
esac

cd "$REPO" || fail "cannot enter $REPO"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] && fail "refusing to run on main. Check out the absorb branch first."
# Tracked-file dirtiness is the risk: the agent would commit someone else's
# half-finished edit alongside its own. Untracked files (this launcher and its
# prompt, on a fresh setup) are harmless and the agent commits them itself.
[ -z "$(git status --porcelain --untracked-files=no)" ] || fail "tracked files are modified. Commit or stash first."

mkdir -p "$LOGDIR"
echo "ox_absorb: tree $REPO on branch $BRANCH, prompt $(basename "$PROMPT")"
echo "ox_absorb: logging to $LOG"

# Everything below the horizontal rule is the task; the header above it is for
# a human reader.
TASK="$(sed -n '/^---$/,$p' "$PROMPT" | tail -n +2)"
# A prompt file with no `---` line yields an empty task, and dsh answers that
# with "a task is required" after the smoke test has already passed, which
# reads like a model problem and is not one. Catch it here instead.
[ ${#TASK} -gt 200 ] || fail "extracted no task from $PROMPT. The file needs a
  line that is exactly \`---\`; everything after it is the task."

"$DSH" --profile headless --patch "$PATCH" "$TASK" 2>&1 | tee "$LOG"
echo "ox_absorb: exited with ${PIPESTATUS[0]}" | tee -a "$LOG"
echo "ox_absorb: commits since start:" | tee -a "$LOG"
git log --oneline -10 | tee -a "$LOG"
echo "ox_absorb: done. Read $LOG and git log before trusting anything."
