use git2::Repository;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::GitError;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub commit_id: String,
    pub column: usize,
    pub connections: Vec<GraphConnection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GraphConnection {
    pub from_column: usize,
    pub to_column: usize,
    pub to_row: usize,
    pub is_merge: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommitGraph {
    pub nodes: Vec<GraphNode>,
    pub max_columns: usize,
}

/// Build a commit graph for visualization
/// This algorithm assigns columns to commits and creates connection lines
pub fn build_commit_graph(
    repo: &Repository,
    commit_ids: &[String],
) -> Result<CommitGraph, GitError> {
    use std::time::Instant;
    let start = Instant::now();
    
    if commit_ids.is_empty() {
        return Ok(CommitGraph {
            nodes: vec![],
            max_columns: 0,
        });
    }

    let mut nodes = Vec::new();
    let mut active_columns: Vec<Option<String>> = vec![]; // Track which commit each column is waiting for
    let mut commit_to_row: HashMap<String, usize> = HashMap::new();

    // First pass: create a lookup from commit ID to row index
    for (row, commit_id) in commit_ids.iter().enumerate() {
        commit_to_row.insert(commit_id.clone(), row);
    }

    for (_row, commit_id) in commit_ids.iter().enumerate() {
        let commit = repo.find_commit(git2::Oid::from_str(commit_id)?)?;
        let parent_ids: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();

        // Find which column this commit should be in
        let column = find_column_for_commit(&mut active_columns, commit_id);

        // Clear this column since we're processing the commit it was waiting for
        if column < active_columns.len() {
            active_columns[column] = None;
        }

        // Create connections to parents
        let mut connections = Vec::new();

        for (i, parent_id) in parent_ids.iter().enumerate() {
            let is_merge = i > 0;

            // Check if parent is already expected in another column (branch convergence)
            let existing_column = active_columns
                .iter()
                .position(|c| c.as_ref() == Some(&parent_id.to_string()));

            let parent_column = if let Some(existing_col) = existing_column {
                // Parent already expected in another column - converge to that column
                existing_col
            } else if i == 0 {
                // First parent, not expected elsewhere - continue in same column
                active_columns[column] = Some(parent_id.clone());
                column
            } else {
                // Merge parent needs its own column
                find_or_create_column(&mut active_columns, parent_id)
            };

            // Only create connection if parent is in our commit list
            if let Some(&parent_row) = commit_to_row.get(parent_id) {
                connections.push(GraphConnection {
                    from_column: column,
                    to_column: parent_column,
                    to_row: parent_row,
                    is_merge,
                });
            }
        }

        // If no parents (or parents not in list), the column stays closed (already set to None)

        nodes.push(GraphNode {
            commit_id: commit_id.clone(),
            column,
            connections,
        });

        // Compact columns (remove empty columns from the right)
        while active_columns.last() == Some(&None) {
            active_columns.pop();
        }
    }

    let max_columns = nodes.iter().map(|n| n.column).max().unwrap_or(0) + 1;

    tracing::info!("build_commit_graph took {:?} for {} commits", start.elapsed(), commit_ids.len());
    
    Ok(CommitGraph { nodes, max_columns })
}

fn find_column_for_commit(active_columns: &mut Vec<Option<String>>, commit_id: &str) -> usize {
    // Check if any column is waiting for this commit
    for (i, col) in active_columns.iter().enumerate() {
        if col.as_ref() == Some(&commit_id.to_string()) {
            return i;
        }
    }

    // Find first empty column or create new one
    for (i, col) in active_columns.iter().enumerate() {
        if col.is_none() {
            return i;
        }
    }

    // Create new column
    active_columns.push(None);
    active_columns.len() - 1
}

fn find_or_create_column(active_columns: &mut Vec<Option<String>>, commit_id: &str) -> usize {
    // Check if already assigned
    for (i, col) in active_columns.iter().enumerate() {
        if col.as_ref() == Some(&commit_id.to_string()) {
            return i;
        }
    }

    // Find empty column
    for (i, col) in active_columns.iter_mut().enumerate() {
        if col.is_none() {
            *col = Some(commit_id.to_string());
            return i;
        }
    }

    // Create new column
    active_columns.push(Some(commit_id.to_string()));
    active_columns.len() - 1
}
