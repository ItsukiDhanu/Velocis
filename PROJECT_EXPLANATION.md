# Velocis Project Explanation

## 1. Project Overview

Velocis is a Git-like version control simulator.

It does not run real Git commands. Instead, it stores version-control concepts in a MySQL database:

- users
- repositories
- branches
- commits
- commit parent relationships
- staged files
- file blobs
- merges
- rollback logs

The purpose of the project is to show how Git-like systems can be represented using database tables and a web interface.

## 2. Tech Stack

Frontend:

- React
- Vite
- TailwindCSS
- React Router

Backend:

- Node.js
- Express.js
- Passport.js
- GitHub OAuth
- MySQL using `mysql2`

Database:

- MySQL
- Tables are defined in `server/sql/schema.sql`

## 3. Main User Flow

1. The user opens the React frontend.
2. If the user is not logged in, they are sent to the login page.
3. The user clicks `Sign in with GitHub`.
4. The backend redirects the user to GitHub OAuth.
5. GitHub sends the user back to the backend callback route.
6. The backend creates or updates the user in MySQL.
7. A session cookie keeps the user logged in.
8. The user can create repositories, branches, upload files, commit files, merge branches, rollback commits, and view the commit graph.

## 4. Authentication

Important files:

- `server/src/auth.js`
- `server/src/middleware/requireAuth.js`
- `server/src/index.js`

Authentication uses GitHub OAuth through `passport-github2`.

When the user logs in:

1. GitHub returns the user profile.
2. The backend checks if the GitHub user already exists in the `users` table.
3. If the user is new, the backend inserts the user.
4. If the user already exists, the backend updates username, avatar URL, and profile URL.
5. Passport stores only the user ID in the session.
6. On later requests, Passport loads the full user from the database.

The `requireAuth` middleware protects API routes. If a request is not logged in, it returns `401 Unauthorized`.

## 5. Database Tables

### `users`

Stores users who log in with GitHub.

Important fields:

- `id`
- `github_id`
- `username`
- `avatar_url`
- `profile_url`

### `repositories`

Stores repositories created by users.

Important fields:

- `id`
- `owner_id`
- `name`
- `description`
- `visibility`

A repository belongs to one user.

Repository names are unique per owner. This means two different users can both have a repository with the same name.

### `branches`

Stores branches inside repositories.

Important fields:

- `id`
- `repo_id`
- `name`
- `head_commit_id`
- `is_default`

The `head_commit_id` points to the latest commit on that branch.

Branch names are unique inside a single repository. This means every repository can have its own `main` branch.

### `commits`

Stores commit records.

Important fields:

- `id`
- `repo_id`
- `branch_id`
- `author_id`
- `message`
- `is_merge`
- `created_at`

Each commit belongs to one repository and one branch.

### `commit_parents`

Stores relationships between commits.

Example:

```text
commit 5 has parent commit 4
```

For a normal commit, there is usually one parent.

For a merge commit, there can be two parents:

```text
merge commit 8 has parents 6 and 7
```

This table is what makes the commit history and graph possible.

### `merges`

Stores merge records.

Important fields:

- `repo_id`
- `source_branch_id`
- `target_branch_id`
- `merge_commit_id`

This records which branch was merged into which target branch.

### `rollback_logs`

Stores rollback actions.

Important fields:

- `branch_id`
- `from_commit_id`
- `to_commit_id`
- `actor_id`
- `reason`

Rollback does not delete commits. It only moves the branch head to an older commit and records the action.

### `file_blobs`

Stores actual uploaded file content.
  
Important fields:

- `sha256`
- `size_bytes`
- `content_type`
- `content`

The backend calculates a SHA-256 hash for each uploaded file. If the same file content already exists, the existing blob can be reused.

### `repo_files`

Stores file paths inside repositories.

Example:

```text
src/App.jsx
README.md
server/index.js
```

### `staging_files`

Stores files that have been uploaded but not committed yet.

This simulates Git staging.

### `commit_files`

Connects committed files to commits.

It records which file blob belongs to which commit.

## 6. Repository Creation

Important backend file:

- `server/src/routes/repositories.js`

When a user creates a repository:

1. The backend inserts a row into `repositories`.
2. The backend automatically creates a default branch called `main`.
3. The repository starts without commits until files are staged and committed.

Only the repository owner can make changes to the repository.

Public repositories can be viewed by other logged-in users, but they cannot modify them.

## 7. Branch Creation

When a branch is created:

1. The user enters a branch name.
2. The backend checks that the user owns the repository.
3. The backend creates the new branch.
4. The new branch starts from the current branch head.

This means the new branch begins from the same latest commit as the selected branch.

## 8. File Staging

Important files:

- `client/src/pages/Repository.jsx`
- `server/src/routes/repositories.js`

When the user stages files:

1. The user selects files from the browser.
2. The frontend sends files using `multipart/form-data`.
3. The backend receives files using `multer`.
4. The backend calculates a SHA-256 hash for each file.
5. The backend stores the file content in `file_blobs`.
6. The backend adds file entries into `staging_files`.

At this point, the files are not committed yet. They are only staged.

## 9. Commit Flow

When the user creates a commit:

1. The backend checks the repository and branch.
2. The backend checks that the user is the owner.
3. The backend loads all staged files for the selected branch.
4. The backend creates a new row in `commits`.
5. If the branch already has a `HEAD`, the old head becomes the parent of the new commit.
6. The backend stores file-to-commit links in `commit_files`.
7. The branch `head_commit_id` is updated to the new commit.
8. The staging area is cleared.

This simulates the basic idea of Git commits.

## 10. Merge Flow

Important backend file:

- `server/src/routes/branches.js`

Merge in this project is simplified.

When the user merges:

1. The user selects a source branch.
2. The current branch is treated as the target branch.
3. The backend creates one new commit.
4. That new commit has two parents:
   - the old target branch head
   - the source branch head
5. The new commit is marked with `is_merge = 1`.
6. The target branch head moves to the new merge commit.
7. A merge record is stored in the `merges` table.

Important limitation:

This project does not perform real file conflict resolution. It records the merge structure and history.

## 11. Rollback Flow

Rollback means moving a branch head back to an older commit.

When the user performs rollback:

1. The user selects an older commit.
2. The backend checks that the commit belongs to the same repository.
3. The backend updates the branch `head_commit_id`.
4. The backend stores the rollback action in `rollback_logs`.

Important point:

Rollback does not delete commits. Old commits can still exist in the database, but they may no longer be reachable from the current branch head.

## 12. Commit Graph

Important frontend files:

- `client/src/pages/Graph.jsx`
- `client/src/components/CommitGraph.jsx`

The backend returns:

- commits
- parent relationships
- branches

The frontend draws an SVG graph:

- commits are shown as nodes
- parent relationships are shown as lines
- branches are shown as lanes
- merge commits use a different color
- branch heads are highlighted

This visualizes the repository history.

## 13. Frontend Pages

### `client/src/pages/Login.jsx`

Shows the GitHub login page.

The login button sends the user to the backend GitHub OAuth route.

### `client/src/pages/Dashboard.jsx`

Shows:

- repositories owned by the logged-in user
- public repositories
- form to create a new repository

### `client/src/pages/Repository.jsx`

This is the main repository page.

It contains:

- branch selector
- staging area
- commit form
- new branch form
- file list
- commit timeline
- merge modal
- rollback modal
- delete repository modal

### `client/src/pages/Graph.jsx`

Shows the visual commit graph.

## 14. API Helper

Important file:

- `client/src/lib/api.js`

The `apiFetch` helper wraps the normal browser `fetch`.

It handles:

- API base URL
- cookies using `credentials: "include"`
- JSON content type
- backend error messages
- form data uploads

This keeps API calls cleaner in the frontend pages.

## 15. Server Entry Point

Important file:

- `server/src/index.js`

This file:

- loads environment variables
- checks required environment values
- creates the Express app
- configures JSON parsing
- configures CORS in development
- configures session cookies
- initializes Passport
- registers authentication routes
- registers repository and branch API routes
- serves the built frontend in production
- starts the server

## 16. Environment Variables

Important files:

- `server/.env`
- `server/.env.example`
- `server/src/env.js`

Environment variables include:

- database host
- database user
- database password if needed
- database name
- GitHub OAuth client ID
- GitHub OAuth client secret
- GitHub callback URL
- session secret
- frontend origin
- server port

The `.env.example` file shows what values are required without exposing real secrets.

## 17. Migrations

Important files:

- `server/scripts/migrate.js`
- `server/sql/migrations/001_file_storage.sql`

Migrations are SQL files used to update an older database.

For a fresh database, `schema.sql` already creates the full current structure.

For an old database, this command runs migration files:

```bash
npm run db:migrate
```

The migration script reads all `.sql` files in `server/sql/migrations` and runs them in filename order.

## 18. Deleted Files

The following files were removed because they are not needed for the current fresh setup:

- `server/sql/seed.sql`
- `server/sql/migrations/002_scope_repo_branch_uniques.sql`

If these files are still open in VS Code tabs, those tabs are stale. They are no longer part of the project.

## 19. Important Limitations

This project is a simulator, not a full Git replacement.

Current limits:

- It does not run real Git commands.
- It does not calculate line-by-line diffs.
- It stores file snapshots, not patch changes.
- Merge commits record two parents, but there is no conflict resolution.
- Rollback moves the branch head, but does not delete old commits.

These limits are acceptable because the project focuses on demonstrating core version-control concepts.

## 20. Explanation For Teacher

You can explain the project like this:

```text
My project is a Git-like version control simulator. It does not call real Git commands.
I designed MySQL tables to represent repositories, branches, commits, parent commit
relationships, staged files, file blobs, merges, and rollback logs.

The backend is built with Node.js and Express. Authentication is handled using GitHub
OAuth with Passport.js. The frontend is built with React and TailwindCSS.

Each branch stores its latest commit using head_commit_id. Every new commit is linked
to its parent using the commit_parents table. Merge commits are represented by a
commit with two parents. Rollback is implemented by moving the branch head to an
older commit and recording the action in rollback_logs.

Files are first staged, then committed. File content is stored as blobs using SHA-256
hashing. The commit graph page reads commits and parent relationships from the
database and draws a visual graph on the frontend.
```

## 21. Strong Points To Mention

- The project has real GitHub OAuth login.
- It has ownership checks for private and public repositories.
- Public repositories can be viewed but not modified by non-owners.
- The database design models commits and parent relationships clearly.
- Merge commits are represented using two parent commits.
- Rollback is logged instead of deleting history.
- File staging and committing are separated.
- The frontend includes a visual commit graph.

## 22. Short Summary

Velocis is a learning-focused Git simulator. It uses React for the frontend, Express for the backend, GitHub OAuth for login, and MySQL for storing version-control data. It demonstrates repositories, branches, commits, file staging, merges, rollbacks, and commit graph visualization without using real Git internally.
