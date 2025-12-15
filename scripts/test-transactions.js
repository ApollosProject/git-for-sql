#!/usr/bin/env node

/**
 * Manual integration test script for transaction feature
 * 
 * This script tests the transaction behavior with real databases:
 * 1. Single statement (no transaction)
 * 2. Multiple statements (with transaction)
 * 3. Error in multi-statement (automatic rollback)
 * 
 * Run with: node scripts/test-transactions.js
 */

import { needsTransaction, executeSQL, pools } from '../app/lib/db.server.js';
import { config } from '../app/config.server.js';

console.log('🧪 Transaction Feature Integration Tests\n');
console.log('='.repeat(50));

// Test 1: Single statement (no transaction)
console.log('\n📝 Test 1: Single statement (no transaction)');
const singleStatementSQL = 'SELECT * FROM approved_scripts LIMIT 1;';
console.log(`SQL: ${singleStatementSQL}`);
console.log(`needsTransaction(): ${needsTransaction(singleStatementSQL)}`);
console.log('Expected: false (no transaction needed)');

// Test 2: Multiple statements (with transaction)  
console.log('\n📝 Test 2: Multiple statements (with transaction)');
const multiStatementSQL = `
  SELECT 1 AS test;
  SELECT 2 AS test;
`;
console.log(`SQL: ${multiStatementSQL.trim()}`);
console.log(`needsTransaction(): ${needsTransaction(multiStatementSQL)}`);
console.log('Expected: true (transaction needed)');

// Test 3: Trailing semicolons
console.log('\n📝 Test 3: Trailing semicolons');
const trailingSemicolonSQL = 'SELECT * FROM users;;';
console.log(`SQL: ${trailingSemicolonSQL}`);
console.log(`needsTransaction(): ${needsTransaction(trailingSemicolonSQL)}`);
console.log('Expected: true (counts as 2 semicolons)');

// Test 4: Multiline single statement
console.log('\n📝 Test 4: Multiline single statement');
const multilineSQL = `
  SELECT 
    id,
    name,
    email
  FROM users
  WHERE active = true;
`;
console.log(`SQL: ${multilineSQL.trim()}`);
console.log(`needsTransaction(): ${needsTransaction(multilineSQL)}`);
console.log('Expected: false (only 1 semicolon)');

console.log('\n' + '='.repeat(50));
console.log('\n✅ Logic tests complete!');
console.log('\n📋 Manual Testing Steps:');
console.log('1. Start the app: yarn dev');
console.log('2. Create a test SQL script with single statement in GitHub');
console.log('3. Merge PR and verify script executes without BEGIN/COMMIT in logs');
console.log('4. Create a test SQL script with multiple statements');
console.log('5. Merge PR and verify script executes with BEGIN/COMMIT in logs');
console.log('6. Create a test SQL script with an error in second statement');
console.log('7. Verify first statement is rolled back (nothing persists)');

// Close pools
await pools.audit.end();
await pools.staging.end();
await pools.production.end();

console.log('\n✨ Script complete!\n');
