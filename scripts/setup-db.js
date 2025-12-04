#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
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

async function setupDb() {
  console.log('Database Setup\n');

  // Check if using existing databases
  const useExisting = await question('Are you using existing databases? (y/N): ');
  
  if (useExisting.toLowerCase() === 'y') {
    console.log('✅ Skipping database creation. Using existing databases.');
    rl.close();
    return;
  }

  // Get database connection info
  let dbUser = 'postgres';
  let dbHost = 'localhost';
  let dbPort = '5432';

  // Try to read .env to get database URLs
  if (existsSync(join(rootDir, '.env'))) {
    try {
      const envFile = readFileSync(join(rootDir, '.env'), 'utf-8');
      const auditUrl = envFile.match(/AUDIT_DB_URL=postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (auditUrl) {
        dbUser = auditUrl[1];
        dbHost = auditUrl[3];
        dbPort = auditUrl[4];
        console.log(`Using database connection from .env: ${dbUser}@${dbHost}:${dbPort}\n`);
      }
    } catch (e) {
      // .env exists but couldn't parse, ask for info
    }
  }

  // If not found in .env, ask for connection info
  if (!existsSync(join(rootDir, '.env')) || !dbUser || dbUser === 'postgres') {
    dbUser = await question(`PostgreSQL user [${dbUser}]: `) || dbUser;
    dbHost = await question(`PostgreSQL host [${dbHost}]: `) || dbHost;
    dbPort = await question(`PostgreSQL port [${dbPort}]: `) || dbPort;
  }

  const databases = ['audit_db', 'staging_db', 'prod_db'];

  console.log('\nCreating PostgreSQL databases...\n');

  let createdCount = 0;
  let skippedCount = 0;

  for (const db of databases) {
    try {
      execSync(`psql -U ${dbUser} -h ${dbHost} -p ${dbPort} -c "CREATE DATABASE ${db};" 2>&1`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      console.log(`✅ Created ${db}`);
      createdCount++;
    } catch (error) {
      // Capture error output from stderr/stdout
      const errorOutput = (error.stderr || error.stdout || error.message || String(error)).toString();
      if (errorOutput.includes('already exists')) {
        console.log(`⚠️  ${db} already exists (skipping)`);
        skippedCount++;
      } else {
        console.error(`❌ Failed to create ${db}`);
        const cleanError = errorOutput.trim().split('\n').find(line => line.trim()) || 'Unknown error';
        console.error(`   ${cleanError}`);
      }
    }
  }

  if (skippedCount > 0 && createdCount === 0) {
    console.log('\n💡 All databases already exist. No changes needed.');
  }

  console.log('\n✅ Database setup complete!');
  rl.close();
}

setupDb().catch((error) => {
  console.error('❌ Setup failed:', error.message);
  rl.close();
  process.exit(1);
});

