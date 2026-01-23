//! File system watcher for automatic repository refresh.
//!
//! Watches the repository working directory and emits debounced events
//! to the frontend when files change.

use notify_debouncer_mini::{
    new_debouncer,
    notify::{RecursiveMode, RecommendedWatcher},
    DebounceEventResult, Debouncer,
};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tracing::{debug, error, info, warn};

/// Payload for the repo_changed event
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoChangedEvent {
    /// The repository path that changed
    pub repo_path: String,
    /// Number of files that changed (may be aggregated due to debouncing)
    pub file_count: usize,
}

/// Manages the file system watcher for a repository
pub struct RepoWatcher {
    /// The debouncer that handles file events
    debouncer: Debouncer<RecommendedWatcher>,
    /// Path being watched
    path: PathBuf,
}

impl RepoWatcher {
    /// Create a new watcher for the given repository path
    pub fn new(repo_path: PathBuf, app: AppHandle) -> Result<Self, String> {
        let repo_path_clone = repo_path.clone();

        // Create debouncer with 100ms debounce time
        let debouncer = new_debouncer(
            Duration::from_millis(100),
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        let file_count = events.len();
                        if file_count > 0 {
                            debug!("File watcher: {} events in {:?}", file_count, repo_path_clone);

                            // Emit event to frontend
                            let payload = RepoChangedEvent {
                                repo_path: repo_path_clone.to_string_lossy().to_string(),
                                file_count,
                            };

                            if let Err(e) = app.emit("repo_changed", payload) {
                                error!("Failed to emit repo_changed event: {}", e);
                            }
                        }
                    }
                    Err(errors) => {
                        warn!("File watcher error: {:?}", errors);
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        Ok(Self {
            debouncer,
            path: repo_path,
        })
    }

    /// Start watching the repository
    pub fn start(&mut self) -> Result<(), String> {
        info!("Starting file watcher for {:?}", self.path);

        self.debouncer
            .watcher()
            .watch(&self.path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to start watching: {}", e))
    }

    /// Stop watching the repository
    pub fn stop(&mut self) -> Result<(), String> {
        info!("Stopping file watcher for {:?}", self.path);

        self.debouncer
            .watcher()
            .unwatch(&self.path)
            .map_err(|e| format!("Failed to stop watching: {}", e))
    }
}

/// State manager for the file watcher
pub struct WatcherState {
    watcher: Arc<Mutex<Option<RepoWatcher>>>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
        }
    }

    /// Start watching a repository
    /// 
    /// This spawns the watcher setup in a background thread to avoid blocking
    /// the UI during tab switches. The watcher may take a moment to be ready
    /// for large repositories.
    pub fn watch(&self, repo_path: PathBuf, app: AppHandle) -> Result<(), String> {
        let watcher_arc = Arc::clone(&self.watcher);
        
        // Spawn watcher setup in background to avoid blocking UI
        std::thread::spawn(move || {
            let mut watcher_guard = match watcher_arc.lock() {
                Ok(guard) => guard,
                Err(e) => {
                    error!("Failed to acquire watcher lock: {}", e);
                    return;
                }
            };

            // Stop existing watcher if any
            if let Some(ref mut existing) = *watcher_guard {
                let _ = existing.stop();
            }

            // Create and start new watcher
            match RepoWatcher::new(repo_path.clone(), app) {
                Ok(mut watcher) => {
                    if let Err(e) = watcher.start() {
                        error!("Failed to start watcher for {:?}: {}", repo_path, e);
                        return;
                    }
                    *watcher_guard = Some(watcher);
                }
                Err(e) => {
                    error!("Failed to create watcher for {:?}: {}", repo_path, e);
                }
            }
        });

        Ok(())
    }

    /// Stop watching the current repository
    pub fn unwatch(&self) -> Result<(), String> {
        let mut watcher_guard = self.watcher.lock().map_err(|e| e.to_string())?;

        if let Some(ref mut watcher) = *watcher_guard {
            watcher.stop()?;
        }

        *watcher_guard = None;
        Ok(())
    }
}

impl Default for WatcherState {
    fn default() -> Self {
        Self::new()
    }
}
