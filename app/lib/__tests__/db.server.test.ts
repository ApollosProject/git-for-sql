import { describe, test, expect } from "vitest";
import { needsTransaction, analyzeSQL } from "../db.server";

describe("analyzeSQL - RETURNING clause detection", () => {
  describe("SELECT queries", () => {
    test("detects basic SELECT query", () => {
      const sql = "SELECT * FROM users;";
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(true);
      expect(result.hasReturning).toBe(false);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects SELECT with WHERE clause", () => {
      const sql = "SELECT id, name FROM users WHERE active = true;";
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(true);
      expect(result.hasReturning).toBe(false);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects multiline SELECT query", () => {
      const sql = `
        SELECT
          id,
          name,
          email
        FROM users
        WHERE active = true;
      `;
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });
  });

  describe("UPDATE with RETURNING", () => {
    test("detects UPDATE with RETURNING *", () => {
      const sql = "UPDATE charges SET amount = 500 WHERE id = 123 RETURNING *;";
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(false);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects UPDATE with RETURNING specific columns", () => {
      const sql =
        "UPDATE charges SET amount = 500 WHERE id = 123 RETURNING id, amount, updated_at;";
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(false);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects multiline UPDATE with RETURNING", () => {
      const sql = `
        UPDATE charges
        SET
          amount = 500,
          campus_id = 'abc-123'
        WHERE stripe_charge_id = 'ch_xyz'
        RETURNING id, amount, campus_id, updated_at;
      `;
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(false);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects Cameron's backfill query with RETURNING", () => {
      const sql = `
        UPDATE charges
        SET
          amount = (se.stripe_event_data -> 'data' -> 'object' -> 'amount')::INTEGER,
          campus_id = CASE
            WHEN se.stripe_event_data -> 'data' -> 'object' -> 'metadata' -> 'campusId' IS NOT NULL
            THEN SPLIT_PART(se.stripe_event_data -> 'data' -> 'object' -> 'metadata' ->> 'campusId', ':', 2)::UUID
            ELSE NULL
          END
        FROM stripe_events se
        WHERE se.stripe_event_data -> 'data' -> 'object' ->> 'id' = charges.stripe_charge_id
          AND charges.amount IS NULL
        RETURNING charges.id, charges.stripe_charge_id, charges.amount;
      `;
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(false);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });
  });

  describe("INSERT with RETURNING", () => {
    test("detects INSERT with RETURNING", () => {
      const sql =
        "INSERT INTO users (name, email) VALUES ('John', 'john@example.com') RETURNING id, created_at;";
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(false);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects multiline INSERT with RETURNING *", () => {
      const sql = `
        INSERT INTO users (name, email, active)
        VALUES ('Jane Doe', 'jane@example.com', true)
        RETURNING *;
      `;
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(false);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects bulk INSERT with RETURNING", () => {
      const sql = `
        INSERT INTO test_table (name, value)
        VALUES
          ('test1', 100),
          ('test2', 200),
          ('test3', 300)
        RETURNING id, name, value;
      `;
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });
  });

  describe("DELETE with RETURNING", () => {
    test("detects DELETE with RETURNING", () => {
      const sql =
        "DELETE FROM old_records WHERE created_at < '2020-01-01' RETURNING id, created_at;";
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(false);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects DELETE with RETURNING *", () => {
      const sql = "DELETE FROM temp_data WHERE processed = true RETURNING *;";
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });
  });

  describe("DML without RETURNING", () => {
    test("UPDATE without RETURNING should not capture rows", () => {
      const sql = "UPDATE charges SET amount = 500 WHERE id = 123;";
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(false);
      expect(result.hasReturning).toBe(false);
      expect(result.shouldCaptureRows).toBe(false);
    });

    test("INSERT without RETURNING should not capture rows", () => {
      const sql = "INSERT INTO users (name) VALUES ('test');";
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(false);
      expect(result.hasReturning).toBe(false);
      expect(result.shouldCaptureRows).toBe(false);
    });

    test("DELETE without RETURNING should not capture rows", () => {
      const sql = "DELETE FROM users WHERE id = 123;";
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(false);
      expect(result.hasReturning).toBe(false);
      expect(result.shouldCaptureRows).toBe(false);
    });
  });

  describe("Edge cases with comments", () => {
    test("ignores RETURNING in single-line comment", () => {
      const sql = `
        -- This query is not returning anything
        UPDATE charges SET amount = 500 WHERE id = 123;
      `;
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(false);
      expect(result.shouldCaptureRows).toBe(false);
    });

    test("ignores RETURNING in multi-line comment", () => {
      const sql = `
        /*
         * Note: We could use RETURNING here but chose not to
         * for performance reasons
         */
        UPDATE charges SET amount = 500 WHERE id = 123;
      `;
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(false);
      expect(result.shouldCaptureRows).toBe(false);
    });

    test("detects RETURNING when also in comments", () => {
      const sql = `
        -- Update with RETURNING clause
        UPDATE charges
        SET amount = 500
        WHERE id = 123
        RETURNING id, amount; -- Return the updated row
      `;
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("handles mixed comments and RETURNING", () => {
      const sql = `
        /* Block comment */
        UPDATE charges SET amount = 500 -- inline comment
        WHERE id = 123
        RETURNING *; -- return everything
      `;
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });
  });

  describe("Case insensitivity", () => {
    test("detects lowercase returning", () => {
      const sql = "update charges set amount = 500 returning id;";
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects mixed case ReTuRnInG", () => {
      const sql = "UPDATE charges SET amount = 500 ReTuRnInG id;";
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects lowercase select", () => {
      const sql = "select * from users;";
      const result = analyzeSQL(sql);
      expect(result.isSelectQuery).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });
  });

  describe("Multi-statement queries", () => {
    test("detects RETURNING in first statement", () => {
      const sql = `
        UPDATE table1 SET x = 1 RETURNING *;
        UPDATE table2 SET y = 2;
      `;
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects RETURNING in second statement", () => {
      const sql = `
        UPDATE table1 SET x = 1;
        UPDATE table2 SET y = 2 RETURNING *;
      `;
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("detects RETURNING in both statements", () => {
      const sql = `
        UPDATE table1 SET x = 1 RETURNING id;
        UPDATE table2 SET y = 2 RETURNING id;
      `;
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });
  });

  describe("Complex real-world queries", () => {
    test("handles subqueries with RETURNING", () => {
      const sql = `
        UPDATE charges c
        SET campus_id = (SELECT id FROM campuses WHERE is_default = true)
        WHERE c.campus_id IS NULL
        RETURNING c.id, c.campus_id;
      `;
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("handles CTE (WITH clause) with RETURNING", () => {
      const sql = `
        WITH updated_charges AS (
          UPDATE charges SET processed = true WHERE amount > 100
          RETURNING id, amount
        )
        SELECT * FROM updated_charges;
      `;
      const result = analyzeSQL(sql);
      // This starts with WITH but contains RETURNING and SELECT
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });

    test("handles JOIN in UPDATE with RETURNING", () => {
      const sql = `
        UPDATE charges c
        SET
          amount = se.amount,
          campus_id = se.campus_id
        FROM stripe_events se
        WHERE se.charge_id = c.stripe_charge_id
          AND c.amount IS NULL
        RETURNING c.id, c.amount, c.campus_id;
      `;
      const result = analyzeSQL(sql);
      expect(result.hasReturning).toBe(true);
      expect(result.shouldCaptureRows).toBe(true);
    });
  });
});

describe("needsTransaction", () => {
  test("single statement with semicolon returns false", () => {
    const sql = "SELECT * FROM users LIMIT 10;";
    expect(needsTransaction(sql)).toBe(false);
  });

  test("single statement without semicolon returns false", () => {
    const sql = "SELECT * FROM users";
    expect(needsTransaction(sql)).toBe(false);
  });

  test("two statements returns true", () => {
    const sql =
      "UPDATE users SET active = true; UPDATE users SET last_login = NOW();";
    expect(needsTransaction(sql)).toBe(true);
  });

  test("multiple statements returns true", () => {
    const sql = `
      INSERT INTO users (name) VALUES ('test1');
      INSERT INTO users (name) VALUES ('test2');
      INSERT INTO users (name) VALUES ('test3');
    `;
    expect(needsTransaction(sql)).toBe(true);
  });

  test("empty string returns false", () => {
    const sql = "";
    expect(needsTransaction(sql)).toBe(false);
  });

  test("trailing semicolons counted correctly", () => {
    const sql = "SELECT * FROM users;;";
    expect(needsTransaction(sql)).toBe(true);
  });

  test("multiline single statement returns false", () => {
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

  test("complex multi-statement returns true", () => {
    const sql = `
      CREATE TABLE test (id INT);
      INSERT INTO test VALUES (1);
      UPDATE test SET id = 2;
      DELETE FROM test WHERE id = 2;
    `;
    expect(needsTransaction(sql)).toBe(true);
  });

  test("already wrapped in transaction returns false", () => {
    const sql = `
      BEGIN;
      UPDATE users SET active = true;
      UPDATE users SET last_login = NOW();
      COMMIT;
    `;
    expect(needsTransaction(sql)).toBe(false);
  });

  test("already wrapped with BEGIN and COMMIT returns false", () => {
    const sql = "BEGIN; INSERT INTO users (name) VALUES ('test'); COMMIT;";
    expect(needsTransaction(sql)).toBe(false);
  });

  test("case insensitive BEGIN/COMMIT detection", () => {
    const sql = "begin; SELECT 1; SELECT 2; commit;";
    expect(needsTransaction(sql)).toBe(false);
  });
});
