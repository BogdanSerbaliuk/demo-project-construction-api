import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query("SELECT email, created_at FROM users ORDER BY created_at");
console.log("users in database:", rows.map(r => r.email));
console.log("ADMIN_EMAIL in .env:", process.env.ADMIN_EMAIL);
console.log("match:", rows.some(r => r.email === process.env.ADMIN_EMAIL));
await pool.end();
