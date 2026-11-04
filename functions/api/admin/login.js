const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value) {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function hashPassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  ));
}

async function createToken(email, secret) {
  const payload = base64url(encoder.encode(JSON.stringify({
    email,
    exp: Math.floor(Date.now() / 1000) + 28800
  })));

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  return payload + "." + base64url(new Uint8Array(signature));
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB || !env.SESSION_SECRET) {
      return Response.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
    }

    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return Response.json({ error: "Informe e-mail e senha." }, { status: 400 });
    }

    const user = await env.DB.prepare(
      "SELECT email, password_hash FROM admin_users WHERE email = ? LIMIT 1"
    ).bind(email).first();

    if (!user) {
      return Response.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }

    const parts = user.password_hash.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") {
      return Response.json({ error: "Cadastro de administrador inválido." }, { status: 500 });
    }

    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 1000000) {
      return Response.json({ error: "Configuração de senha inválida." }, { status: 500 });
    }

    const salt = decodeBase64Url(parts[2]);
    const expected = decodeBase64Url(parts[3]);
    const actual = await hashPassword(password, salt, iterations);

    if (actual.length !== expected.length ||
        !actual.every((byte, index) => byte === expected[index])) {
      return Response.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }

    const token = await createToken(user.email, env.SESSION_SECRET);

  const headers = new Headers();

headers.set("Content-Type", "application/json; charset=utf-8");
headers.set("Cache-Control", "no-store");
headers.append(
  "Set-Cookie",
  `nexora_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`
);

return new Response(
  JSON.stringify({
    success: true,
    message: "Login realizado com sucesso."
  }),
  {
    status: 200,
    headers
  }
);
