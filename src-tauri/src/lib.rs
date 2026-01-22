pub mod commands;
pub mod git;

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
            commands::get_commit_history,
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
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
