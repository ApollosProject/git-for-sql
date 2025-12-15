import { describe, test, expect } from 'vitest';
import { needsTransaction } from '../db.server';

describe('needsTransaction', () => {
  test('single statement with semicolon returns false', () => {
    const sql = 'SELECT * FROM users LIMIT 10;';
    expect(needsTransaction(sql)).toBe(false);
  });

  test('single statement without semicolon returns false', () => {
    const sql = 'SELECT * FROM users';
    expect(needsTransaction(sql)).toBe(false);
  });

  test('two statements returns true', () => {
    const sql = 'UPDATE users SET active = true; UPDATE users SET last_login = NOW();';
    expect(needsTransaction(sql)).toBe(true);
  });

  test('multiple statements returns true', () => {
    const sql = `
      INSERT INTO users (name) VALUES ('test1');
      INSERT INTO users (name) VALUES ('test2');
      INSERT INTO users (name) VALUES ('test3');
    `;
    expect(needsTransaction(sql)).toBe(true);
  });

  test('empty string returns false', () => {
    const sql = '';
    expect(needsTransaction(sql)).toBe(false);
  });

  test('trailing semicolons counted correctly', () => {
    const sql = 'SELECT * FROM users;;';
    expect(needsTransaction(sql)).toBe(true);
  });

  test('multiline single statement returns false', () => {
    const sql = `
      SELECT 
        id, 
        name, 
        email 
      FROM users 
      WHERE active = true;
    `;
    expect(needsTransaction(sql)).toBe(false);
  });

  test('complex multi-statement returns true', () => {
    const sql = `
      CREATE TABLE test (id INT);
      INSERT INTO test VALUES (1);
      UPDATE test SET id = 2;
      DELETE FROM test WHERE id = 2;
    `;
    expect(needsTransaction(sql)).toBe(true);
  });

  test('already wrapped in transaction returns false', () => {
    const sql = `
      BEGIN;
      UPDATE users SET active = true;
      UPDATE users SET last_login = NOW();
      COMMIT;
    `;
    expect(needsTransaction(sql)).toBe(false);
  });

  test('already wrapped with BEGIN and COMMIT returns false', () => {
    const sql = 'BEGIN; INSERT INTO users (name) VALUES (\'test\'); COMMIT;';
    expect(needsTransaction(sql)).toBe(false);
  });

  test('case insensitive BEGIN/COMMIT detection', () => {
    const sql = 'begin; SELECT 1; SELECT 2; commit;';
    expect(needsTransaction(sql)).toBe(false);
  });
});
