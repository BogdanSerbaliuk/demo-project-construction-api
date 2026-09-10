// Fires deliberately bad requests at the API and reports what came back.
// Every line should show a sensible 4xx — and the server must still be alive
// at the end.
const BASE = "http://localhost:3000";

async function probe(label, path, options, expected) {
    try {
        const res = await fetch(BASE + path, options);
        const text = await res.text();
        const flag = res.status === expected ? "ok  " : "BAD ";
        console.log(`${flag}${String(res.status).padEnd(4)} (want ${expected})  ${label}`);
        if (res.status !== expected) console.log(`      -> ${text.slice(0, 120)}`);
    } catch (err) {
        console.log(`DEAD      (want ${expected})  ${label}  -> ${err.cause?.code ?? err.message}`);
    }
}

const json = (body) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});

await probe("empty body", "/api/leads", json({}), 400);
await probe("missing phone", "/api/leads", json({ name: "Bogdan" }), 400);
await probe("wrong types", "/api/leads", json({ name: 12345, phone: true }), 400);
await probe("name too short", "/api/leads", json({ name: "B", phone: "+380001112233" }), 400);
await probe("null values", "/api/leads", json({ name: null, phone: null }), 400);

await probe("no Content-Type", "/api/leads", {
    method: "POST",
    body: JSON.stringify({ name: "Bogdan", phone: "+380001112233" }),
}, 400);

await probe("malformed JSON", "/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"name": "Bogdan", "phone":',
}, 400);

await probe("5 MB message", "/api/leads", json({
    name: "Bogdan", phone: "+380001112233", message: "x".repeat(5_000_000),
}), 413);

await probe("bad uuid (now behind auth)", "/api/leads/not-a-uuid", {}, 401);
await probe("unknown uuid (now behind auth)", "/api/leads/00000000-0000-4000-8000-000000000000", {}, 401);
await probe("unknown route", "/api/nonsense", {}, 404);

await probe("SQL injection attempt", "/api/leads",
    json({ name: "Bobby'); DROP TABLE leads;--", phone: "+380001112233" }), 201);
await probe("extra fields", "/api/leads",
    json({ name: "Bogdan", phone: "+380001112233", isAdmin: true }), 201);

const alive = await fetch(BASE + "/").then((r) => r.ok).catch(() => false);
console.log(alive ? "\nserver still alive" : "\nSERVER DIED");
