const BASE = "http://localhost:3000";

async function login(email, password, label) {
    const res = await fetch(`${BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    console.log(`${label}: ${res.status}`, await res.json());
    const cookies = res.headers.getSetCookie();
    if (cookies.length) console.log("   Set-Cookie:", cookies[0]);
}

await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, "correct password");
await login(process.env.ADMIN_EMAIL, "definitely-wrong", "wrong password  ");
await login("nobody@example.com", "whatever", "unknown email  ");