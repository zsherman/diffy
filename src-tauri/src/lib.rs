pub mod commands;
pub mod git;

#[cfg(debug_assertions)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_repository,
            commands::discover_repository,
            commands::list_branches,
            commands::checkout_branch,
            commands::create_branch,
            commands::get_commit_history,
            commands::get_commit_history_all_branches,
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
            commands::fix_ai_review_issues,
            commands::list_worktrees,
            commands::create_worktree,
            commands::remove_worktree,
            commands::lock_worktree,
            commands::unlock_worktree,
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
