#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand).
# Exit 0 skips the build, exit 1 builds. Anything unexpected builds.
#
# 1. Previews build only for commits on an open pull request. Pushes to a
#    branch with no PR yet are skipped; put "[preview]" in the commit message
#    to force one, or hit Redeploy in Vercel.
# 2. The registry bot commit after each merge is skipped: the merge build
#    already ran build-registry.ts (see buildCommand), so it would ship the
#    same files again.
# 3. Commits that only touch repo tooling (.github, .claude, root *.md) are
#    skipped everywhere.

set -u

build() {
  echo "Building: $1"
  exit 1
}

skip() {
  echo "Skipping build: $1"
  exit 0
}

message="${VERCEL_GIT_COMMIT_MESSAGE:-}"

if [[ "$message" == *"[preview]"* ]]; then
  build "commit asks for a preview"
fi

if [[ "${VERCEL_ENV:-}" == "preview" && -z "${VERCEL_GIT_PULL_REQUEST_ID:-}" ]]; then
  skip "preview for ${VERCEL_GIT_COMMIT_REF:-unknown branch} has no pull request"
fi

# Compare against the last commit this project deployed on this branch, so a
# push of several commits is judged on all of them, not only the newest (a
# batch ending in a README edit used to skip the whole batch). Vercel clones
# about 10 commits deep; if that commit isn't in the clone, or the branch has
# never deployed, fall back to the parent commit.
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [[ -z "$base" ]] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  base="HEAD^"
fi
echo "Comparing against $base"

# Shallow clones may not have the parent commit; build to be safe.
changed="$(git diff --name-only "$base" HEAD 2>/dev/null)" ||
  build "could not diff against $base"

if [[ -z "$changed" ]]; then
  build "empty diff"
fi

# Judged on the bot commit alone: it lands while the merge build is still
# running, so the last deployed commit is still the one before the merge.
author="$(git log -1 --format=%an 2>/dev/null)"
if [[ "$author" == "github-actions[bot]" ]] &&
  bot_changed="$(git diff --name-only HEAD^ HEAD 2>/dev/null)" &&
  ! grep -qvE '^(registry\.json|public/r/|public/\.well-known/agent-skills/)' <<<"$bot_changed"; then
  skip "registry bot commit; the merge build already generated these files"
fi

if ! grep -qvE '^(\.github/|\.claude/|[^/]+\.md$)' <<<"$changed"; then
  skip "only repo tooling or root Markdown changed"
fi

build "site files changed"
