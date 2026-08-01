# Repository boundary rules

This workspace is the fork `onionviolet/grimoire`.

## GitHub scope

- Treat `origin` (`onionviolet/grimoire`) as the only repository that may be
  changed.
- Treat `upstream` (`Slush97/grimoire`) as read-only. Do not create, edit,
  comment on, close, reopen, label, assign, lock, transfer, or otherwise
  mutate upstream issues, pull requests, discussions, releases, or projects.
- Every mutating GitHub CLI/API command must name the target explicitly with
  `--repo onionviolet/grimoire` (or the equivalent API path). Never rely on
  the CLI's inferred repository.
- Before any mutating GitHub action, state the exact `owner/repository` and
  object number being changed, then verify it matches `onionviolet/grimoire`.
- If a task needs an upstream change, stop and ask for explicit direction. Do
  not use a fork-side action as a substitute.

## Cross-reference hygiene

- Do not mention upstream issue or pull-request identifiers in GitHub-facing
  fork content: commit messages, issue/PR titles or bodies, review comments,
  release notes, or discussion posts. GitHub can create an automatic backlink
  in the upstream timeline from such references.
- Record upstream provenance in repository files (for example `docs/`) when
  it is useful; GitHub does not create conversation backlinks from repository
  file contents.
- If a GitHub-facing fork issue or pull request must link upstream, use a
  `https://redirect.github.com/<owner>/<repo>/issues/<number>` URL instead of
  a GitHub issue shorthand or `github.com` URL. GitHub documents that this
  avoids generating a backlink.
- Do not use closing keywords for upstream objects in fork commits or pull
  requests.
- Treat existing automatic cross-references as benign metadata, not comments
  authored by an agent. Do not rewrite published history merely to remove one
  unless the user explicitly requests the history rewrite and accepts a
  force-push.
- A backlink is one-way and permanent. This was measured, not assumed: fork
  issues 6/13/17/18 were edited to replace their bare upstream numbers with
  redirect URLs, and every `cross-referenced` event stayed in the upstream
  timeline afterwards. Removing the referencing text is a fix for the next
  reader, never for the event. Prevention is the only control that works.
- Text inside backticks is inert. Fork issue 13 quoted an upstream commit
  title containing `(#113)` inside a code span and upstream 113 shows no
  backlink from it, while the bare numbers elsewhere in the same body all
  linked. Quoting a commit subject verbatim is fine if it stays in a code span.

## Enforcement

- `scripts/check-upstream-refs.mjs` fails a commit message that carries a bare
  `#n` in the upstream number range, a `Slush97/<repo>#n` reference, or a
  `github.com` upstream issue/PR URL. Backticked text and `redirect.github.com`
  URLs pass. Commits reachable from `upstream/main` are exempt, so merging
  upstream's own `(#326)` squash subjects does not trip it.
- It runs in three places: `.husky/commit-msg` (the message being written),
  `.husky/pre-push` via `pnpm refs:check` (catches amend, rebase and
  cherry-pick, which route around commit-msg), and the "Upstream backlink
  guard" step in `.github/workflows/ci.yml` (catches `--no-verify` and pushes
  from a machine without hooks installed).
- The bare-number rule keys off `UPSTREAM_NUMBER_FLOOR` in that script: fork
  issue numbers are two digits, upstream's are three. Raise the floor before
  fork numbering reaches it, or the gate will start rejecting our own refs.
- No gate exists for issue, PR, or comment bodies typed into GitHub; nothing
  local sees them. Those are covered by the rules above and by using
  `redirect.github.com` every time.

## Git remotes

- Fetching from `upstream` is allowed when needed for comparison or merging.
- Push only to `origin` unless the user explicitly authorizes another remote.
