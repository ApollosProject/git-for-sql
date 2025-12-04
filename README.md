# Git for SQL

Peer-reviewed SQL execution tool with GitHub integration and audit logging.

## Quick Start

```bash
# Install dependencies
yarn install

# Run setup (creates databases, .env file, generates secrets)
yarn setup

# Start development server
yarn dev
```

Visit `http://localhost:3000`

## Features

- ✅ Peer review via GitHub PRs (requires 2+ approvals)
- ✅ Staging-first workflow (must run in staging before production)
- ✅ Full audit trail with user tracking
- ✅ Result capture for SELECT queries
- ✅ Auto-sync from GitHub webhooks
- ✅ GitHub OAuth for user identification

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL installed and running
- GitHub account

### Quick Setup

Run `yarn setup` to get started. This will:

1. Create PostgreSQL databases (audit, staging, production)
2. Generate `.env` file template
3. Generate webhook and session secrets
4. Show instructions for GitHub token and webhook setup

### Manual Setup Steps

If you prefer manual setup:

1. **Create databases**: `yarn setup:db` (or create manually)
2. **Generate .env**: `yarn setup:env` (then edit with your values)
3. **Generate secrets**: `yarn setup:secrets`

### GitHub Configuration

#### Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate token with `repo` scope
3. Add to `.env` as `GITHUB_TOKEN`

#### Webhook Setup

**For Local Development (using ngrok):**

1. Install ngrok: https://ngrok.com/download
2. Start your app: `yarn dev`
3. Start ngrok in another terminal: `ngrok http 3000`
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. Add webhook to GitHub:
   - Go to your repo → Settings → Webhooks → Add webhook
   - **Payload URL**: `https://abc123.ngrok.io/api/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: Use value from `GITHUB_WEBHOOK_SECRET` in `.env`
   - **Events**: Select "Let me select individual events" → Check only "Pull requests"
   - Click "Add webhook"
6. Keep ngrok running while testing webhooks locally

**For Production:**

1. Go to your repo → Settings → Webhooks → Add webhook
2. **Payload URL**: `https://your-domain.com/api/webhook/github`
3. **Content type**: `application/json`
4. **Secret**: Use value from `GITHUB_WEBHOOK_SECRET` in `.env`
5. **Events**: Select "Let me select individual events" → Check only "Pull requests"
6. Click "Add webhook"

## Usage

1. **Create SQL script** in your GitHub repo's `sql/` folder (or folder specified in `GITHUB_SQL_FOLDER`)
2. **Create PR** and get 2+ approvals
3. **Merge PR** - script appears in dashboard automatically
4. **Execute on Staging** first
5. **Execute on Production** after successful staging run

### SQL Script Format

```sql
-- Author: user@example.com
-- Purpose: Description
-- TargetDatabase: staging
-- DirectProd (optional - bypasses staging requirement)

SELECT * FROM users;
```

**Note**: The `-- DirectProd` flag allows a script to run directly on production without staging execution.

## Configuration

Edit `.env` file:

```env
# Databases
AUDIT_DB_URL=postgresql://user:pass@localhost:5432/audit_db
STAGING_DB_URL=postgresql://user:pass@localhost:5432/staging_db
PROD_DB_URL=postgresql://user:pass@localhost:5432/prod_db

# GitHub
GITHUB_TOKEN=ghp_your_token
GITHUB_REPO=org/repo-name
GITHUB_SQL_FOLDER=sql/
GITHUB_WEBHOOK_SECRET=generated_secret

# Optional: GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=your_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_client_secret
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3000/auth/github/callback

# Session
SESSION_SECRET=generated_secret
MIN_APPROVALS=2
```

## Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn setup` - Run full setup wizard
- `yarn setup:db` - Create databases only
- `yarn setup:env` - Generate .env file only
- `yarn setup:secrets` - Generate secrets only

## Troubleshooting

**Database connection fails:**
- Check PostgreSQL is running: `pg_isready`
- Verify database URLs in `.env`
- Ensure databases exist

**Webhook not working:**
- Verify webhook secret matches
- Check webhook deliveries in GitHub
- Ensure URL is accessible (for local dev, keep ngrok running)

**Scripts not appearing:**
- Wait 30 seconds (auto-refresh)
- Click "Sync" button to manually sync
- Verify PR was merged (not closed)
- Check PR has required approvals
- Ensure SQL files are in `GITHUB_SQL_FOLDER`

## Tech Stack

- React Router v7 (TypeScript)
- PostgreSQL
- GitHub API (Octokit)

## License

MIT
