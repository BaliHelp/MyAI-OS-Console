#!/usr/bin/env node
/**
 * Generate a bcrypt password hash for use in ADMIN_PASSWORD_HASH env variable.
 * 
 * Usage:
 *   npm run generate-hash
 *   → Enter your desired password when prompted
 *   → Copy the output hash into .env.local as ADMIN_PASSWORD_HASH
 */

import bcrypt from "bcryptjs";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter password to hash: ", async (password) => {
  if (!password || password.length < 8) {
    console.error("❌ Password must be at least 8 characters.");
    rl.close();
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 10);
  console.log("\n✅ bcrypt hash (copy this into .env.local):");
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log("\n⚠️  Never share or commit this hash to version control.");
  rl.close();
});
