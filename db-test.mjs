import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
    const { rows } = await pool.query("SELECT now() AS t");
    console.log("CONNECTED:", rows[0].t);

    const tables = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    );
    console.log("TABLES:", tables.rows.map((r) => r.table_name));
} catch (err) {
    console.log("FAILED:", err.code || "", err.message);
} finally {
    await pool.end();
}
