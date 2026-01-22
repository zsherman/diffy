# Agent Guidelines

This document provides guidance for AI agents working on this codebase.

## Package Manager

**Use `bun`** for all package management and script execution.

```bash
bun install          # Install dependencies
bun add <pkg>        # Add a dependency
bun add -D <pkg>     # Add a dev dependency
bun remove <pkg>     # Remove a dependency
bun run <script>     # Run a script from package.json
```

## Type Checking

**Use `tsgo`** for type-checking (faster than tsc).

```bash
bun run typecheck    # Run tsgo --noEmit
```

Note: The build script still uses `tsc` for emit because tsgo's emit feature is not yet stable.

## Linting

**Use `oxlint`** for linting (faster than ESLint).

```bash
bun run lint         # Lint src/ directory
bun run fix          # Auto-fix lint issues
```

## Project Structure

- **Frontend**: React 19 + TypeScript in `src/`
- **Backend**: Tauri/Rust in `src-tauri/`
- **Styling**: Tailwind CSS

## Development Workflow

1. Make changes to the codebase
2. Run `bun run typecheck` to verify types
3. Run `bun run lint` to check for issues
4. Run `bun run dev` to test in the Tauri app

## Key Technologies

| Category | Tool |
|----------|------|
| Package Manager | bun |
| Type Checker | tsgo (@typescript/native-preview) |
| Linter | oxlint |
| Build (TS) | tsc |
| Bundler | Vite |
| Frontend | React 19, TanStack Query, XState Store |
| Desktop | Tauri 2 |
| Styling | Tailwind CSS |
| UI Components | Base UI (React) |
