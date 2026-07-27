#!/usr/bin/env bash
# LOCAL FORK ONLY (branch `local/all-features`). Absorb upstream changes and
# rebuild the integration branch on top of them.
#
# The model: we do NOT maintain a long-lived diverged fork. We maintain a small
# set of single-concern patch branches, each cut from upstream `main`, and an
# integration branch that is nothing but merges of those. That is why absorbing
# an upstream release is cheap: rebase each patch, re-merge, done. A conflict is
# isolated to the one patch that touched the same lines, instead of being one
# giant unreviewable merge.
#
#   upstream/main ──┬── fix/a ──┐
#                   ├── fix/b ──┼── local/all-features  (merges only)
#                   └── feat/c ─┘
#
# Usage:  bash scripts/sync-upstream.sh [--no-push]
#
# The script never force-pushes and never deletes a branch. On a rebase conflict
# it stops, leaves the repo in the conflicted state, and tells you which patch
# failed so you can resolve it by hand.

set -euo pipefail

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_URL="https://github.com/Slush97/grimoire.git"
INTEGRATION="local/all-features"

# Every patch branch that composes the integration branch, in merge order.
PATCHES=(
    "fix/global-sound-swap-locker-bucket"
    "feat/audition-randomizer-pools"
)

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# --- preflight ---------------------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
    echo "working tree is dirty; commit or stash first" >&2
    exit 1
fi

if ! git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1; then
    say "adding remote '$UPSTREAM_REMOTE' -> $UPSTREAM_URL"
    git remote add "$UPSTREAM_REMOTE" "$UPSTREAM_URL"
fi

say "fetching $UPSTREAM_REMOTE"
git fetch "$UPSTREAM_REMOTE" --tags

BEFORE=$(git rev-parse main)
git checkout main
git merge --ff-only "$UPSTREAM_REMOTE/main"
AFTER=$(git rev-parse main)

if [ "$BEFORE" = "$AFTER" ]; then
    say "already up to date with upstream ($(git rev-parse --short main)); nothing to absorb"
    exit 0
fi

say "upstream moved: $(git rev-parse --short "$BEFORE") -> $(git rev-parse --short "$AFTER")"
git log --oneline "$BEFORE..$AFTER" | sed 's/^/    /'

# --- rebase each patch onto the new main -------------------------------------
for branch in "${PATCHES[@]}"; do
    say "rebasing $branch onto main"
    git checkout "$branch"
    if ! git rebase main; then
        cat >&2 <<EOF

CONFLICT while rebasing '$branch' onto the new upstream main.

The repo is left mid-rebase on purpose. Resolve it, then:
    git add -A && git rebase --continue
    bash scripts/sync-upstream.sh      # re-run to finish the rest

To abandon instead:
    git rebase --abort
EOF
        exit 1
    fi
done

# --- rebuild the integration branch ------------------------------------------
# Rebuilt from scratch rather than merged into, so it stays a pure composition
# of main + the patches, with no drift accumulating in it over time.
say "rebuilding $INTEGRATION from main + patches"
git checkout -B "$INTEGRATION" main
for branch in "${PATCHES[@]}"; do
    echo "    merging $branch"
    if ! git merge --no-edit "$branch"; then
        # The generated locale manifest conflicts routinely and is regenerated,
        # never hand-merged.
        if git diff --name-only --diff-filter=U | grep -qx 'src/locales/manifest.json'; then
            echo "    (regenerating conflicted locale manifest)"
            git checkout --ours src/locales/manifest.json
            pnpm i18n:manifest >/dev/null
            git add src/locales/manifest.json
            git commit --no-edit
        else
            echo "unresolved conflict merging '$branch' into $INTEGRATION" >&2
            git diff --name-only --diff-filter=U >&2
            exit 1
        fi
    fi
done

say "verifying"
pnpm install --frozen-lockfile >/dev/null
pnpm typecheck
pnpm lint
pnpm test
pnpm i18n:check

cat <<EOF

$INTEGRATION rebuilt on upstream $(git rev-parse --short main) and verified.

Next, for a packaged build:
    cd ../vpkmerge && git checkout local/all-features && cargo +stable-x86_64-pc-windows-msvc build --release -p vpkmerge-cli
    cd ../grimoire && pnpm use-local-vpkmerge
    GRIMOIRE_FORK_BUILD=1 GRIMOIRE_SOCIAL_BASE_URL=https://grimoire-social.slusheliott.workers.dev pnpm package:win

  Both env vars are load-bearing:
    GRIMOIRE_FORK_BUILD=1     disables the updater, which otherwise reads
                              upstream's feed and offers to install stock
                              Grimoire over this build (see services/updater.ts).
    GRIMOIRE_SOCIAL_BASE_URL  is baked into the renderer and cannot be changed
                              after packaging. It must be the REAL Worker (the
                              same one upstream's release.yml bakes), not a
                              placeholder: Discover, Profiles, Stats and the
                              Browse social calls all hit it, and a bogus URL
                              ships a build where those pages are dead. An
                              earlier version of this file suggested
                              example.invalid, which did exactly that.
EOF

if [ "${1:-}" != "--no-push" ]; then
    echo
    echo "(nothing pushed; push the patch branches yourself when you want them on the fork)"
fi
