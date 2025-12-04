#!/usr/bin/env node

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function setupEnv() {
  console.log('Setting up .env file...\n');

  if (existsSync(join(rootDir, '.env'))) {
    console.log('⚠️  .env file already exists.');
    console.log('   To regenerate, delete .env first or use: yarn setup:env');
    rl.close();
    process.exit(0);
  }

  // Generate secrets
  const webhookSecret = randomBytes(32).toString('hex');
  const sessionSecret = randomBytes(32).toString('hex');

  // Get user input
  const dbUser = await question('PostgreSQL user [postgres]: ') || 'postgres';
  const dbPass = await question('PostgreSQL password: ');
  const dbHost = await question('PostgreSQL host [localhost]: ') || 'localhost';
  const dbPort = await question('PostgreSQL port [5432]: ') || '5432';

  const githubToken = await question('GitHub token (ghp_...): ');
  const githubRepo = await question('GitHub repo (org/repo-name): ');
  const sqlFolder = await question('SQL folder [sql/]: ') || 'sql/';
  const minApprovals = await question('Minimum approvals [2]: ') || '2';

  const oauthEnabled = await question('Enable GitHub OAuth? (y/N): ');
  let oauthClientId = '';
  let oauthClientSecret = '';
  let oauthCallback = '';

  if (oauthEnabled.toLowerCase() === 'y') {
    oauthClientId = await question('OAuth Client ID: ');
    oauthClientSecret = await question('OAuth Client Secret: ');
    oauthCallback = await question('OAuth Callback URL [http://localhost:3000/auth/github/callback]: ') || 'http://localhost:3000/auth/github/callback';
  }

  let oauthSection = '';
  if (oauthEnabled.toLowerCase() === 'y') {
    oauthSection = `# GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=${oauthClientId}
GITHUB_OAUTH_CLIENT_SECRET=${oauthClientSecret}
GITHUB_OAUTH_CALLBACK_URL=${oauthCallback}
`;
  } else {
    oauthSection = `# GitHub OAuth (optional)
# GITHUB_OAUTH_CLIENT_ID=
# GITHUB_OAUTH_CLIENT_SECRET=
# GITHUB_OAUTH_CALLBACK_URL=http://localhost:3000/auth/github/callback
`;
  }

  const envContent = `# Database URLs
AUDIT_DB_URL=postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/audit_db
STAGING_DB_URL=postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/staging_db
PROD_DB_URL=postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/prod_db

# GitHub Configuration
GITHUB_TOKEN=${githubToken}
GITHUB_REPO=${githubRepo}
GITHUB_SQL_FOLDER=${sqlFolder}
GITHUB_WEBHOOK_SECRET=${webhookSecret}

${oauthSection}# Session Configuration
SESSION_SECRET=${sessionSecret}

# Minimum required approvals
MIN_APPROVALS=${minApprovals}
`;

  writeFileSync(join(rootDir, '.env'), envContent);
  console.log('\n✅ .env file created!');
  console.log('\n📝 Next steps:');
  console.log('1. Review and edit .env if needed');
  console.log('2. Set up GitHub webhook with secret:', webhookSecret);
  console.log('3. Run: yarn dev');
  rl.close();
}

setupEnv().catch(console.error);

