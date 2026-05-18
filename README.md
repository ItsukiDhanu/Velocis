# Velocis

Velocis is a Git-like version control simulator for coursework demos. It stores
repositories, branches, commits, file snapshots, merges, and rollbacks in MySQL
tables instead of shelling out to real Git commands.

The goal is to make the core version-control ideas visible in a small web app:
OAuth login, repository ownership, public read access, branch heads, commit
parent links, staged files, and a simple commit graph.

## Tech Stack

- Frontend: React + TailwindCSS
- Backend: Node.js + Express
- Database: MySQL
- Auth: GitHub OAuth

## Setup

### 1) Database

Create the database and tables:

```bash
mysql -u <user> -p -e "CREATE DATABASE velocis;"
mysql -u <user> -p velocis < server/sql/schema.sql
```

If you already have an older database, run the migrations:

```bash
npm run db:migrate
```

Or run the SQL files directly in order:

```bash
mysql -u <user> -p velocis < server/sql/migrations/001_file_storage.sql
```

### 2) Server env

Create `server/.env` from the example file, then fill in your DB credentials and
GitHub OAuth values:

```bash
cp server/.env.example server/.env
```

Required values:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`
- `DB_PASSWORD` if your local MySQL user needs one
- `SESSION_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`
- `CLIENT_ORIGIN`

### 3) Install dependencies

```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 4) Run in dev

```bash
npm run dev
```

The server runs on http://localhost:3000 and the Vite dev server runs on http://localhost:5173.

### 5) Build + run

```bash
npm run build
npm run start
```

## OAuth setup

Create a GitHub OAuth app with this callback URL:

```
http://localhost:3000/auth/github/callback
```

Then put the client ID and secret in server/.env.

## Implementation Notes

- Repository names are unique per owner, not globally.
- Branch names are unique inside one repository, so every repo can still have a
  `main` branch.
- Public repositories can be viewed by logged-in users, but branch, staging,
  commit, merge, rollback, and delete actions require ownership.
- Rollback does not delete commits. It moves the branch head and records the
  action in `rollback_logs`, so old commits can remain in the database.
- File uploads are stored as SHA-256-addressed blobs and linked to commits
  through `commit_files`.

## Current Limits

- There is no real diff engine yet; commits store file snapshots.
- Merge commits record two parents but do not perform conflict resolution.
- Migrations are plain SQL files run in filename order.
