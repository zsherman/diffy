pub mod commands;
pub mod error;
pub mod git;
pub mod watcher;

#[cfg(debug_assertions)]
use tauri::Manager;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use watcher::WatcherState;

/// Initialize tracing for structured logging and performance debugging.
fn init_tracing() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "diffy=info,warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState::new())
        .invoke_handler(tauri::generate_handler![
            commands::open_repository,
            commands::discover_repository,
            commands::list_branches,
            commands::checkout_branch,
            commands::create_branch,
            commands::get_commit_history,
            commands::get_commit_history_all_branches,
            commands::get_commit_activity_all_branches,
            commands::get_commit_graph,
            commands::get_commit_diff,
            commands::get_file_diff,
            commands::get_working_diff,
            commands::get_status,
            commands::stage_files,
            commands::unstage_files,
            commands::discard_changes,
            commands::create_commit,
            commands::git_fetch,
            commands::git_pull,
            commands::git_push,
            commands::generate_commit_message,
            commands::generate_ai_review,
            commands::generate_contributor_review,
            commands::fix_ai_review_issues,
            commands::list_worktrees,
            commands::create_worktree,
            commands::remove_worktree,
            commands::lock_worktree,
            commands::unlock_worktree,
            // Stash commands
            commands::list_stashes,
            commands::create_stash,
            commands::apply_stash,
            commands::pop_stash,
            commands::drop_stash,
            // Skills commands
            commands::get_skills_dir,
            commands::list_skills,
            commands::install_skill_from_url,
            commands::delete_skill,
            commands::get_skill_content,
            commands::get_skill_raw,
            commands::update_skill,
            // Merge conflict commands
            commands::get_merge_status,
            commands::parse_file_conflicts,
            commands::save_resolved_file,
            commands::mark_file_resolved,
            commands::abort_merge,
            commands::continue_merge,
            commands::merge_branch,
            commands::ai_resolve_conflict,
            // Ahead/behind
            commands::get_ahead_behind,
            // Watcher commands
            commands::start_watching,
            commands::stop_watching,
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let window = _app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
