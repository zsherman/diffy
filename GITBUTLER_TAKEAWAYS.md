# GitButler Takeaways for Diffy

A comprehensive review of GitButler's Tauri/Rust architecture with actionable recommendations for diffy.

---

## Executive Summary

GitButler is a mature, production Tauri + Git application with ~60 Rust crates. After reviewing their codebase, here are the highest-leverage patterns to adopt in diffy, prioritized by impact vs effort.

---

## Top 10 Reusable Ideas

### 1. Structured Error Contract (High Priority)

**What it is:** Replace `Result<T, String>` with a serializable error type that carries both a machine-readable `code` and human-readable `message`.

**Why it helps:**
- Frontend can branch on error codes (e.g., show auth dialog for `errors.projects.git.auth`)
- Better error messages without losing root cause
- Consistent JSON shape: `{ "code": "errors.validation", "message": "..." }`

**GitButler reference:**
- [`inspiration/gitbutler/crates/but-error/src/lib.rs`](inspiration/gitbutler/crates/but-error/src/lib.rs) - `Code` enum and `Context` struct
- [`inspiration/gitbutler/crates/but-api/src/json.rs`](inspiration/gitbutler/crates/but-api/src/json.rs) - Serialization logic

**Diffy files to change:**
- [`src-tauri/src/commands/mod.rs`](src-tauri/src/commands/mod.rs) - Replace `type Result<T> = std::result::Result<T, String>`
- [`src-tauri/src/git/repository.rs`](src-tauri/src/git/repository.rs) - `GitError` already exists, extend it
- [`src/lib/tauri.ts`](src/lib/tauri.ts) - Update error handling to use `code` field

**Implementation sketch:**
```rust
// src-tauri/src/error.rs (new file)
#[derive(Debug, Clone, Copy)]
pub enum Code {
    Unknown,
    Validation,
    GitAuth,
    RepoNotFound,
    MergeConflict,
    NetworkError,
}

#[derive(Debug)]
pub struct AppError {
    pub code: Code,
    pub message: String,
    pub source: Option<Box<dyn std::error::Error + Send + Sync>>,
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("code", &self.code.to_string())?;
        map.serialize_entry("message", &self.message)?;
        map.end()
    }
}
```

---

### 2. Serde camelCase Rename (High Priority)

**What it is:** Use `#[serde(rename_all = "camelCase")]` on Rust structs to eliminate manual TS transformations.

**Why it helps:**
- Remove ~100 lines of adapter code in `src/lib/tauri.ts`
- Type safety without runtime transforms
- Matches JS/TS conventions automatically

**GitButler reference:**
- All API types use `#[serde(rename_all = "camelCase")]`

**Diffy files to change:**
- [`src-tauri/src/git/repository.rs`](src-tauri/src/git/repository.rs) - Add `#[serde(rename_all = "camelCase")]` to all structs
- [`src-tauri/src/git/diff.rs`](src-tauri/src/git/diff.rs)
- [`src-tauri/src/git/graph.rs`](src-tauri/src/git/graph.rs)
- [`src-tauri/src/git/merge.rs`](src-tauri/src/git/merge.rs)
- [`src-tauri/src/commands/mod.rs`](src-tauri/src/commands/mod.rs) - AI review types
- [`src/lib/tauri.ts`](src/lib/tauri.ts) - Remove manual snake_case→camelCase transforms
- [`src/types/git.ts`](src/types/git.ts) - Update to match new field names

**Example:**
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MergeStatus {
    pub in_merge: bool,           // becomes "inMerge" in JSON
    pub conflicting_files: Vec<String>,  // becomes "conflictingFiles"
    pub their_branch: Option<String>,    // becomes "theirBranch"
}
```

---

### 3. Tracing Instrumentation (Medium Priority)

**What it is:** Add `tracing` crate with `#[instrument]` macro on Tauri commands and git operations.

**Why it helps:**
- Performance profiling for slow operations (diff, status, graph)
- Structured logging for debugging
- Can enable tokio-console for async debugging

**GitButler reference:**
- [`inspiration/gitbutler/crates/gitbutler-tauri/src/action.rs`](inspiration/gitbutler/crates/gitbutler-tauri/src/action.rs) - `#[instrument(skip(...), err(Debug))]` on all commands

**Diffy files to change:**
- [`src-tauri/Cargo.toml`](src-tauri/Cargo.toml) - Add `tracing = "0.1"`, `tracing-subscriber`
- [`src-tauri/src/commands/mod.rs`](src-tauri/src/commands/mod.rs) - Add `#[instrument]` to commands
- [`src-tauri/src/main.rs`](src-tauri/src/main.rs) - Initialize tracing subscriber

**Example:**
```rust
use tracing::instrument;

#[tauri::command]
#[instrument(skip(repo_path), err(Debug))]
pub async fn get_status(repo_path: String) -> Result<StatusInfo> {
    // ...
}
```

---

### 4. File Watcher with Debounce (Medium Priority)

**What it is:** Background filesystem watcher that emits debounced "repo changed" events to frontend.

**Why it helps:**
- Automatic refresh of status/diffs without polling
- Better UX (instant feedback on file changes)
- Efficient: debounce aggregates rapid changes

**GitButler reference:**
- [`inspiration/gitbutler/crates/gitbutler-watcher/src/lib.rs`](inspiration/gitbutler/crates/gitbutler-watcher/src/lib.rs) - `WatcherHandle` with cancellation
- Uses `notify` crate + tokio channels

**Diffy files to change:**
- [`src-tauri/Cargo.toml`](src-tauri/Cargo.toml) - Add `notify = "6"`, `tokio-util`
- [`src-tauri/src/watcher.rs`](src-tauri/src/watcher.rs) (new file)
- [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) - Register watcher state
- [`src/stores/git-store.ts`](src/stores/git-store.ts) - Listen to watcher events

**Architecture:**
```
File change → notify → debounce (100ms) → emit("repo_changed") → frontend refetch
```

---

### 5. Two-Phase Diff Model (Medium Priority)

**What it is:** Separate tree→index diff from index→worktree diff, then merge intelligently.

**Why it helps:**
- More accurate representation of staged vs unstaged changes
- Better rename tracking
- Clearer handling of edge cases (file→dir, conflicts)

**GitButler reference:**
- [`inspiration/gitbutler/crates/but-core/src/diff/worktree.rs`](inspiration/gitbutler/crates/but-core/src/diff/worktree.rs) - `Origin::TreeIndex` vs `Origin::IndexWorktree`

**Diffy current state:**
- Already has this pattern in [`src-tauri/src/git/diff.rs`](src-tauri/src/git/diff.rs): `get_working_diff(staged: bool)`

**Improvement:** Return richer metadata (rename tracking, type changes) like GitButler does.

---

### 6. Test Harness with Shell Scripts (High Priority)

**What it is:** Use shell scripts to create git fixture repos, then run tests against them.

**Why it helps:**
- Realistic git state (conflicts, renames, submodules)
- Reproducible and hermetic
- Easy to add new scenarios

**GitButler reference:**
- [`inspiration/gitbutler/crates/but-testsupport/src/lib.rs`](inspiration/gitbutler/crates/but-testsupport/src/lib.rs) - `writable_scenario()`, `git()` helper
- [`inspiration/gitbutler/crates/but-core/tests/core/diff/worktree_changes.rs`](inspiration/gitbutler/crates/but-core/tests/core/diff/worktree_changes.rs) - Extensive test coverage

**Diffy files to create:**
- `src-tauri/tests/` directory
- `src-tauri/tests/fixtures/` for shell scripts
- `src-tauri/tests/git_tests.rs` - Integration tests

---

### 7. Insta Snapshot Testing (Medium Priority)

**What it is:** Use `insta` crate for snapshot testing complex data structures.

**Why it helps:**
- Easy to review changes to output
- Self-documenting tests
- Great for diff/status/graph output

**GitButler reference:**
- All their diff tests use `insta::assert_debug_snapshot!`

**Example:**
```rust
#[test]
fn test_status_with_staged_files() {
    let repo = create_test_repo();
    let status = get_status(&repo).unwrap();
    insta::assert_debug_snapshot!(status);
}
```

---

### 8. Graph Core vs UI Projection Separation (Lower Priority)

**What it is:** Separate the "truth" of the commit graph from its visualization.

**Why it helps:**
- UI can project same graph data differently (stacks, lanes, flat list)
- Graph operations remain correct even with complex merges
- Enables features like workspace/stack views

**GitButler reference:**
- [`inspiration/gitbutler/crates/but-graph/src/lib.rs`](inspiration/gitbutler/crates/but-graph/src/lib.rs) - Segmented graph with projection

**Diffy current state:**
- [`src-tauri/src/git/graph.rs`](src-tauri/src/git/graph.rs) - Column-based visualization mixed with traversal

**Recommendation:** For now, keep current approach but consider separating if adding multi-branch views.

---

### 9. Consider gix Migration (Future)

**What it is:** Migrate from `git2` (libgit2 bindings) to `gix` (pure Rust git).

**Why it helps:**
- Better performance (parallel, streaming)
- Richer status/diff APIs (rename tracking, filters)
- More active development

**GitButler status:**
- Actively migrating from git2 → gix
- `but-oxidize` crate is a bridge layer (marked "soon obsolete")

**Recommendation:** Not urgent for diffy. Start with a vertical slice (status only) if desired.

**Risk:** gix API is less stable than git2.

---

### 10. ts-rs Type Generation (Optional)

**What it is:** Generate TypeScript types from Rust structs automatically.

**Why it helps:**
- Single source of truth for types
- CI can verify TS types match Rust
- No more manual type sync

**GitButler reference:**
- Uses `ts-rs` crate with `#[derive(TS)]`
- Script: `scripts/generate-ts-definitions-from-rust.sh`

**Diffy consideration:** With `#[serde(rename_all = "camelCase")]` the manual types become much simpler. Consider ts-rs only if types drift frequently.

---

## Prioritized Backlog

### Now (Low effort, high impact)
1. **Structured error contract** - 2-3 hours
2. **Serde camelCase rename** - 1-2 hours
3. **Add tracing** - 1 hour

### Next (Medium effort)
4. **File watcher with debounce** - 4-6 hours
5. **Rust integration test harness** - 4-6 hours
6. **Insta snapshot tests** - 2-3 hours

### Later (Higher effort, evaluate need)
7. **Graph core/projection separation** - 8+ hours
8. **gix migration** - 20+ hours (start with slice)
9. **ts-rs codegen** - 4-6 hours
10. **SQLite caching** - 8+ hours (only if profiling shows need)

---

## Implementation Sequence

To keep the app working at each step:

1. **Phase 1: Error contract + camelCase**
   - Add new error type alongside existing
   - Update one command at a time
   - Update TS types to match
   - Remove old adapters after all commands migrated

2. **Phase 2: Tracing + Tests**
   - Add tracing (no breaking changes)
   - Create test harness
   - Add tests for existing functionality
   - Use tests to catch regressions in later phases

3. **Phase 3: Watcher**
   - Add watcher as optional feature
   - Frontend listens but still has manual refresh
   - Remove manual refresh after watcher proven stable

4. **Phase 4: Advanced (as needed)**
   - Graph improvements driven by UI needs
   - gix migration as feature-flag experiment

---

## Quick Reference: GitButler Crates

| Crate | Purpose | Relevance to Diffy |
|-------|---------|-------------------|
| `but-error` | Error codes + context | High - adopt pattern |
| `but-api` | JSON serialization | High - adopt error shape |
| `but-core` | Git primitives | Medium - reference for diff/status |
| `but-graph` | Commit graph | Low - more complex than needed |
| `but-db` | SQLite caching | Low - only if needed |
| `gitbutler-watcher` | File monitoring | Medium - adopt pattern |
| `gitbutler-tauri` | Tauri integration | Medium - reference for plugins/state |
| `but-testsupport` | Test utilities | High - adopt fixtures pattern |

---

## Files Changed Summary

### Rust (src-tauri/)
- `Cargo.toml` - Add tracing, notify, insta
- `src/error.rs` (new) - AppError with Code
- `src/commands/mod.rs` - Use new error, add tracing
- `src/git/*.rs` - Add `#[serde(rename_all = "camelCase")]`
- `src/watcher.rs` (new) - File watcher
- `tests/` (new) - Integration tests

### TypeScript (src/)
- `lib/tauri.ts` - Remove snake_case adapters, use error.code
- `types/git.ts` - Update field names to camelCase
- `stores/git-store.ts` - Listen to watcher events

---

*Generated from review of GitButler at `inspiration/gitbutler/`*
