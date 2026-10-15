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

# Shallow clones may not have the parent commit; build to be safe.
changed="$(git diff --name-only HEAD^ HEAD 2>/dev/null)" ||
  build "could not diff against the parent commit"

if [[ -z "$changed" ]]; then
  build "empty diff"
fi

author="$(git log -1 --format=%an 2>/dev/null)"
if [[ "$author" == "github-actions[bot]" ]] &&
  ! grep -qvE '^(registry\.json|public/r/|public/\.well-known/agent-skills/)' <<<"$changed"; then
  skip "registry bot commit; the merge build already generated these files"
fi

if ! grep -qvE '^(\.github/|\.claude/|[^/]+\.md$)' <<<"$changed"; then
  skip "only repo tooling or root Markdown changed"
fi

build "site files changed"
