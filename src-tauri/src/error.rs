//! Structured error types for Tauri commands.
//!
//! All errors returned to the frontend have a consistent shape:
//! `{ "code": "errors.xxx", "message": "Human readable message" }`

use std::fmt;

/// Error codes that the frontend can branch on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Code {
    /// Fallback for unknown/unexpected errors
    Unknown,
    /// Input validation failed
    Validation,
    /// Repository not found at the given path
    RepoNotFound,
    /// Git authentication required or failed
    GitAuth,
    /// Merge conflict detected
    MergeConflict,
    /// Network/HTTP error
    NetworkError,
    /// File I/O error
    IoError,
    /// JSON parsing error
    ParseError,
    /// Git operation failed
    GitError,
    /// AI/Claude CLI error
    AiError,
    /// Skill not found or invalid
    SkillError,
}

impl Code {
    /// Returns the string code for serialization (e.g., "errors.repo_not_found")
    pub fn as_str(&self) -> &'static str {
        match self {
            Code::Unknown => "errors.unknown",
            Code::Validation => "errors.validation",
            Code::RepoNotFound => "errors.repo_not_found",
            Code::GitAuth => "errors.git_auth",
            Code::MergeConflict => "errors.merge_conflict",
            Code::NetworkError => "errors.network",
            Code::IoError => "errors.io",
            Code::ParseError => "errors.parse",
            Code::GitError => "errors.git",
            Code::AiError => "errors.ai",
            Code::SkillError => "errors.skill",
        }
    }
}

impl fmt::Display for Code {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Application error that serializes to `{ code, message }` for the frontend.
#[derive(Debug)]
pub struct AppError {
    pub code: Code,
    pub message: String,
}

impl AppError {
    pub fn new(code: Code, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn unknown(message: impl Into<String>) -> Self {
        Self::new(Code::Unknown, message)
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new(Code::Validation, message)
    }

    pub fn repo_not_found(path: impl AsRef<str>) -> Self {
        Self::new(
            Code::RepoNotFound,
            format!("Repository not found at: {}", path.as_ref()),
        )
    }

    pub fn git(message: impl Into<String>) -> Self {
        Self::new(Code::GitError, message)
    }

    pub fn io(message: impl Into<String>) -> Self {
        Self::new(Code::IoError, message)
    }

    pub fn parse(message: impl Into<String>) -> Self {
        Self::new(Code::ParseError, message)
    }

    pub fn network(message: impl Into<String>) -> Self {
        Self::new(Code::NetworkError, message)
    }

    pub fn ai(message: impl Into<String>) -> Self {
        Self::new(Code::AiError, message)
    }

    pub fn skill(message: impl Into<String>) -> Self {
        Self::new(Code::SkillError, message)
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

/// Serialize to `{ "code": "...", "message": "..." }` for Tauri IPC
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("code", self.code.as_str())?;
        map.serialize_entry("message", &self.message)?;
        map.end()
    }
}

// Conversion from GitError
impl From<crate::git::GitError> for AppError {
    fn from(err: crate::git::GitError) -> Self {
        use crate::git::GitError;
        match &err {
            GitError::NotFound(path) => AppError::repo_not_found(path),
            GitError::Git(e) => {
                // Check for auth-related errors
                let msg = e.to_string();
                if msg.contains("authentication")
                    || msg.contains("credential")
                    || msg.contains("Permission denied")
                {
                    AppError::new(Code::GitAuth, msg)
                } else {
                    AppError::git(msg)
                }
            }
            GitError::InvalidPath(path) => {
                AppError::validation(format!("Invalid path: {}", path))
            }
        }
    }
}

// Conversion from std::io::Error
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::io(err.to_string())
    }
}

// Conversion from serde_json::Error
impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::parse(err.to_string())
    }
}

// Conversion from reqwest::Error
impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::network(err.to_string())
    }
}

/// Result type alias for Tauri commands
pub type Result<T> = std::result::Result<T, AppError>;
