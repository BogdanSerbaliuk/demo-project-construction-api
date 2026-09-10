import pg from "pg";
import bcrypt from "bcrypt";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env");
    process.exit(1);
}

const hash = await bcrypt.hash(password, 12);

// ON CONFLICT lets you re-run this to change the password without an error.
const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, email, created_at`,
    [email, hash],
);

console.log("admin ready:", rows[0]);
await pool.end();