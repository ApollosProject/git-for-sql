#!/usr/bin/env node

/**
 * Database migration script for Heroku deployment
 * Runs automatically on each Heroku release (see Procfile)
 * Initializes or updates the audit database schema
 */

import { Pool } from "pg";
import { config } from "dotenv";

// Load environment variables
config();

const AUDIT_DB_URL = process.env.AUDIT_DB_URL || process.env.DATABASE_URL;

if (!AUDIT_DB_URL) {
  console.error("❌ Error: AUDIT_DB_URL or DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: AUDIT_DB_URL });

async function runMigrations() {
  try {
    console.log("🔄 Running database migrations...");

    // Migration: Create base tables and indexes
    await pool.query(`
      -- Create sql_execution_log table
      CREATE TABLE IF NOT EXISTS sql_execution_log (
        id SERIAL PRIMARY KEY,
        script_name VARCHAR(255) NOT NULL,
        script_content TEXT NOT NULL,
        executed_by VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW(),
        target_database VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        rows_affected INTEGER,
        error_message TEXT,
        execution_time_ms INTEGER,
        github_pr_url VARCHAR(500),
        approvers JSONB,
        result_data JSONB
      );

      -- Create approved_scripts table
      CREATE TABLE IF NOT EXISTS approved_scripts (
        id SERIAL PRIMARY KEY,
        script_name VARCHAR(255) UNIQUE NOT NULL,
        script_content TEXT NOT NULL,
        target_database VARCHAR(50) NOT NULL,
        github_pr_url VARCHAR(500),
        approvers JSONB,
        approved_at TIMESTAMP DEFAULT NOW(),
        staging_executed BOOLEAN DEFAULT false,
        staging_executed_at TIMESTAMP,
        production_executed BOOLEAN DEFAULT false,
        production_executed_at TIMESTAMP,
        direct_prod BOOLEAN DEFAULT false
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_execution_log_executed_at ON sql_execution_log(executed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_execution_log_script_name ON sql_execution_log(script_name);
      CREATE INDEX IF NOT EXISTS idx_execution_log_status ON sql_execution_log(status);
      CREATE INDEX IF NOT EXISTS idx_approved_scripts_target ON approved_scripts(target_database);
    `);

    console.log("✓ Base tables and indexes created");

    // Migration: Add result_data column if it doesn't exist
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sql_execution_log' 
          AND column_name = 'result_data'
        ) THEN
          ALTER TABLE sql_execution_log ADD COLUMN result_data JSONB;
          RAISE NOTICE 'Added result_data column to sql_execution_log';
        END IF;
      END $$;
    `);

    console.log("✓ Result data column migration complete");

    // Migration: Add staging/production execution tracking columns
    await pool.query(`
      DO $$ 
      BEGIN
        -- Add staging_executed
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'approved_scripts' 
          AND column_name = 'staging_executed'
        ) THEN
          ALTER TABLE approved_scripts ADD COLUMN staging_executed BOOLEAN DEFAULT false;
          RAISE NOTICE 'Added staging_executed column';
        END IF;

        -- Add staging_executed_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'approved_scripts' 
          AND column_name = 'staging_executed_at'
        ) THEN
          ALTER TABLE approved_scripts ADD COLUMN staging_executed_at TIMESTAMP;
          RAISE NOTICE 'Added staging_executed_at column';
        END IF;

        -- Add production_executed
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'approved_scripts' 
          AND column_name = 'production_executed'
        ) THEN
          ALTER TABLE approved_scripts ADD COLUMN production_executed BOOLEAN DEFAULT false;
          RAISE NOTICE 'Added production_executed column';
        END IF;

        -- Add production_executed_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'approved_scripts' 
          AND column_name = 'production_executed_at'
        ) THEN
          ALTER TABLE approved_scripts ADD COLUMN production_executed_at TIMESTAMP;
          RAISE NOTICE 'Added production_executed_at column';
        END IF;

        -- Add direct_prod flag
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'approved_scripts' 
          AND column_name = 'direct_prod'
        ) THEN
          ALTER TABLE approved_scripts ADD COLUMN direct_prod BOOLEAN DEFAULT false;
          RAISE NOTICE 'Added direct_prod column';
        END IF;
      END $$;
    `);

    console.log("✓ Workflow columns migration complete");

    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sql_execution_log', 'approved_scripts')
      ORDER BY table_name;
    `);

    console.log("✓ Verified tables:", result.rows.map((r) => r.table_name).join(", "));

    console.log("✅ All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration error:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations()
  .then(() => {
    console.log("🎉 Database ready!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
