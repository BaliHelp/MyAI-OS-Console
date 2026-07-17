import fs from "fs";
import path from "path";
import { SignJWT } from "jose";

const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const envPath = path.resolve(projectRoot, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2] || "";
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

async function main() {
  const secretStr = process.env.SESSION_SECRET;
  if (!secretStr) {
    console.error("SESSION_SECRET is not configured");
    process.exit(1);
  }

  const secret = new TextEncoder().encode(secretStr);
  const payload = {
    email: "damnbayu@gmail.com",
    role: "owner"
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  console.log("=== SIGNED TOKEN ===");
  console.log(token);
  process.exit(0);
}

main().catch(console.error);
