#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Git for SQL Setup\n');
console.log('This will:');
console.log('1. Create PostgreSQL databases');
console.log('2. Generate .env file (if it doesn\'t exist)');
console.log('3. Show next steps\n');

try {
  // Step 1: Setup databases (optional - user can skip if using existing)
  console.log('Step 1: Database setup...');
  execSync('node scripts/setup-db.js', { cwd: rootDir, stdio: 'inherit' });
  
  // Step 2: Setup .env (skip if already exists)
  if (existsSync(join(rootDir, '.env'))) {
    console.log('\n⚠️  .env file already exists. Skipping .env setup.');
    console.log('   Run "yarn setup:env" if you want to regenerate it.');
  } else {
    console.log('\nStep 2: Setting up .env file...');
    execSync('node scripts/setup-env.js', { cwd: rootDir, stdio: 'inherit' });
  }
  
  console.log('\n✅ Setup complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Set up GitHub webhook (see SETUP.md)');
  console.log('2. Run: yarn dev');
} catch (error) {
  // Don't fail if user chose not to overwrite .env
  if (error.status === 0 || error.message.includes('Skipping')) {
    console.log('\n✅ Setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Set up GitHub webhook (see SETUP.md)');
    console.log('2. Run: yarn dev');
  } else {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

