const BASE = "http://localhost:3000";

// Without a cookie
const anon = await fetch(`${BASE}/api/leads`);
console.log("no cookie      :", anon.status, await anon.json());

// Log in and keep the cookie by hand — the browser does this for you.
const login = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
    }),
});
const cookie = login.headers.getSetCookie()[0].split(";")[0];

const authed = await fetch(`${BASE}/api/leads`, { headers: { Cookie: cookie } });
console.log("with cookie    :", authed.status, `${(await authed.json()).length} leads`);

// A tampered token must fail — this is the signature doing its job.
const bad = await fetch(`${BASE}/api/leads`, { headers: { Cookie: cookie.slice(0, -3) + "xyz" } });
console.log("tampered cookie:", bad.status, await bad.json());

// Submitting is still public.
const submit = await fetch(`${BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Public Person", phone: "+380001112233" }),
});
console.log("public submit  :", submit.status);