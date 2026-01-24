# AI review improvements

What you already have (so we can build on it)
AI review panel is strong already: structured issues with severity/category, filters/search, “dismiss”, “fix selected”, and jump-to-file (src/features/ai-review/components/AIReviewContent.tsx).
Diff viewer is performant and file-collapsible with per-file context menu (src/features/diff/components/DiffViewer.tsx).
UI-native workflow improvements (beyond a checklist/template)
Review “state” + progress (biggest win)
Mark file as reviewed (checkbox / hotkey) and show progress: 12/20 files reviewed, 3 high-sev AI issues remaining.
Persist per repo + ref (branch/commit) so you can leave and come back without losing your place.
Inline comment threads (human review, not just AI)
Line-level comments in the diff (single line + range), with:
threads (resolve/unresolve)
suggestion blocks (copyable patch snippet)
status badges (“needs follow-up”, “nit”, “blocking”)
A compact “Unresolved comments” list that acts like an inbox and can drive navigation.
“Review mode” navigation (reduce cognitive load)
A dedicated mode that turns your panels into a guided flow:
Next/prev unreviewed file
Next/prev AI issue
Skip large diffs by default (you already detect large diffs)
Optional focus mode that temporarily hides non-essential panels.
Smarter AI issue → diff navigation
You already support go-to-file from AI issues; upgrade it to:
go-to-file-and-line when the issue has line info (CodeRabbit has lines today)
highlight the hunk briefly to orient the reviewer
one-click “create comment from AI issue” (turn AI output into a human-review artifact).
Checklist, but contextual and actionable
Instead of one static checklist:
Auto-suggest checklist items based on what changed:
src-tauri/\*\* touched → error handling, threading/async, panics, IO boundaries
UI touched → a11y, loading/empty/error states, keyboard nav
Checklist items can link to specific files (or AI issues) rather than being generic.
Triage dashboard for “what matters”
A small summary card (think “PR header”) inside Diffy:
Risk indicators: large diff, touches core modules, touches auth/secrets-like paths, lots of deletes/renames
Change stats by area (Rust vs TS, UI vs backend)
Suggested test plan fields (manual + commands), with “copy to clipboard”.
Capture “review decisions” as durable artifacts
Allow reviewers to add review notes that export cleanly:
Copy as GitHub comment / PR description snippet
Copy as markdown for changelog
Optionally store notes per commit so they travel with history.
Reviewer ergonomics
Per-file “owner” hint (even lightweight rules based on path) and quick “request review” affordance (if you integrate with GitHub later).
One-click “open file” / “open in editor” from diff + issues.
