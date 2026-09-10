import express from "express";
import cors from "cors";
import pg from "pg";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

// The host assigns a port in production; 3000 is only the local default.
const PORT = process.env.PORT || 3000;

// Which frontend may call this API. Different locally and in production.
const ORIGIN = process.env.ORIGIN || "http://localhost:5173";

const isProd = process.env.NODE_ENV === "production";

const { Pool } = pg;

const app = express();

// credentials: true is required for the browser to send/accept cookies
// across origins. Without it the cookie is silently dropped.
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("error", (err) => console.error("idle client error:", err));

const LeadSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    phone: z.string().trim().min(6, "Phone must be at least 6 characters"),
    message: z.string().trim().max(2000).optional(),
});

const LoginSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
});

// Runs before a protected route: either calls next() to let the request
// through, or answers 401 itself and stops there.
function requireAuth(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ error: "Not logged in" });
    }

    try {
        // Throws if the signature is wrong or the token has expired.
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "Session expired or invalid" });
    }
}

app.get("/", (req, res) => res.send("server is running"));

/* ---------------- auth ---------------- */

app.post("/api/login", async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors });
    }

    const { email, password } = parsed.data;
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];

    // Same response for "no such user" and "wrong password" — otherwise the
    // endpoint tells an attacker which emails have accounts.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
        { sub: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
    );

    res.cookie("token", token, {
        httpOnly: true,   // JavaScript cannot read it — blocks XSS token theft
        // github.io and onrender.com are DIFFERENT SITES, so a Lax cookie would
        // never be sent. Cross-site needs "none", and "none" requires secure.
        sameSite: isProd ? "none" : "lax",
        secure: isProd,   // HTTPS only, in production
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ email: user.email });
});

app.post("/api/logout", (req, res) => {
    res.clearCookie("token");
    res.status(204).end();
});

app.get("/api/me", requireAuth, (req, res) => {
    res.json({ email: req.user.email });
});

/* ---------------- leads ---------------- */

// Public: anyone may submit a lead through the contact form.
app.post("/api/leads", async (req, res) => {
    const parsed = LeadSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors });
    }

    const { name, phone, message } = parsed.data;

    const { rows } = await pool.query(
        `INSERT INTO leads (id, name, phone, message)
         VALUES (gen_random_uuid(), $1, $2, $3)
         RETURNING *`,
        [name, phone, message ?? null],
    );

    console.log("new lead:", rows[0]);
    res.status(201).json(rows[0]);
});

// Private: only the admin may read them.
app.get("/api/leads", requireAuth, async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM leads ORDER BY received_at DESC");
    res.json(rows);
});

app.get("/api/leads/:id", requireAuth, async (req, res) => {
    if (!z.uuid().safeParse(req.params.id).success) {
        return res.status(400).json({ errors: { id: ["Not a valid id"] } });
    }

    const { rows } = await pool.query("SELECT * FROM leads WHERE id = $1", [req.params.id]);

    if (rows.length === 0) {
        return res.status(404).json({ error: "Lead not found" });
    }

    res.json(rows[0]);
});

/* ------------- fallbacks: always last ------------- */

// Nothing above matched.
app.use((req, res) => {
    res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// Four arguments is what makes this an error handler.
app.use((err, req, res, next) => {
    const status = err.status ?? err.statusCode ?? 500;

    // 4xx is the caller's mistake and expected — one line is enough.
    // Only our own failures deserve a stack trace.
    if (status >= 500) console.error(err);
    else console.warn(`${status} ${req.method} ${req.path} — ${err.message}`);

    res.status(status).json({
        error: status === 500 ? "Something went wrong" : err.message,
    });
});

app.listen(PORT, () => console.log(`listening on port ${PORT}`));
