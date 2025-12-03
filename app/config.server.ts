import dotenv from "dotenv";

// Load environment variables (quiet mode to suppress promotional messages)
dotenv.config({ quiet: true });

export const config = {
  databases: {
    staging: process.env.STAGING_DB_URL || "",
    production: process.env.PROD_DB_URL || "",
    audit: process.env.AUDIT_DB_URL || "",
  },
  github: {
    token: process.env.GITHUB_TOKEN || "",
    repo: process.env.GITHUB_REPO || "",
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
    sqlFolder: process.env.GITHUB_SQL_FOLDER || "", // Empty = watch entire repo
    oauth: {
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || "",
      callbackUrl:
        process.env.GITHUB_OAUTH_CALLBACK_URL ||
        "http://localhost:3000/auth/github/callback",
    },
  },
  minApprovals: parseInt(process.env.MIN_APPROVALS || "2"),
  sessionSecret:
    process.env.SESSION_SECRET || "dev-secret-change-in-production",
};

// Validate required config
export function validateConfig() {
  const required = ["AUDIT_DB_URL", "GITHUB_TOKEN", "GITHUB_REPO"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(
      `Warning: Missing environment variables: ${missing.join(", ")}`
    );
  }
}
