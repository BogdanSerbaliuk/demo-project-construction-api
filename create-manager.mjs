import { randomInt } from "node:crypto";
import pg from "pg";
import bcrypt from "bcrypt";

const email = process.argv[2];
if (!email) {
    console.error("Usage: node --env-file=.env create-manager.mjs <email>");
    process.exit(1);
}

// No 0/O or 1/l/I, so it can be typed from paper without mistakes.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const password = [group(), group(), group(), group()].join("-");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email, await bcrypt.hash(password, 12)],
);
await pool.end();

console.log(`\n  Email:    ${email}\n  Password: ${password}\n`);