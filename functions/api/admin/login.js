
const ITERATIONS = 100000;

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function verifyPassword(password, storedHash) {
  const parts = storedHash.split("$");

  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return false;
  }

  const iterations = Number(parts[1]);

  if (!Number.isInteger(iterations) ||
      iterations < 100000 || iterations > 600000) {
    return false;
  }

  const salt = decodeBase64Url(parts[2]);
  const expected = decodeBase64Url(parts[3]);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    key,
    256
  );

  const actual = new Uint8Array(derived);

  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let i = 0; i < actual.length; i++) {
    difference |= actual[i] ^ expected[i];
  }

  return difference === 0;
}

async function createSession(email, secret) {
  const payload = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify({
      email,
      exp: Math.floor(Date.now() / 1000) + 28800
    }))
  );

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return payload + "." +
    encodeBase64Url(new Uint8Array(signature));
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB || !env.SESSION_SECRET) {
      return Response.json(
        { error: "Configuração do servidor incompleta." },
        { status: 500 }
      );
    }

    if (env.SESSION_SECRET.length < 32) {
      return Response.json(
        { error: "Chave de sessão inválida." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 1 ||
      password.length > 128
    ) {
      return Response.json(
        { error: "E-mail ou senha inválidos." },
        { status: 400 }
      );
    }

    const admin = await env.DB
      .prepare(
        "SELECT email, password_hash FROM admin_users WHERE email = ?"
      )
      .bind(email)
      .first();

    if (!admin) {
      return Response.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(
      password,
      admin.password_hash
    );

    if (!valid) {
      return Response.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 }
      );
    }

    const token = await createSession(
      admin.email,
      env.SESSION_SECRET
    );

    return Response.json(
      {
        success: true,
        message: "Login realizado com sucesso."
      },
      {
        headers: {
          "Set-Cookie":
            `nexora_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`,
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    console.error("Erro no login administrativo:", error);

    return Response.json(
      { error: "Erro interno ao realizar login." },
      { status: 500 }
    );
  }
}
