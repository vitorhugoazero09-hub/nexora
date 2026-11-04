
const ITERATIONS = 100000;

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function safeEqual(a, b) {
  const encoder = new TextEncoder();
  const x = encoder.encode(a);
  const y = encoder.encode(b);

  if (x.length !== y.length) return false;

  let difference = 0;

  for (let i = 0; i < x.length; i++) {
    difference |= x[i] ^ y[i];
  }

  return difference === 0;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    key,
    256
  );

  return [
    "pbkdf2",
    ITERATIONS,
    encodeBase64Url(salt),
    encodeBase64Url(new Uint8Array(hash))
  ].join("$");
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB || !env.ADMIN_SETUP_SECRET) {
      return Response.json(
        { error: "Configuração incompleta." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const setupSecret = String(body.setup_secret || "");
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!safeEqual(setupSecret, env.ADMIN_SETUP_SECRET)) {
      return Response.json(
        { error: "Autorização inválida." },
        { status: 403 }
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 ||
      password.length > 128
    ) {
      return Response.json(
        { error: "Informe um e-mail válido e uma senha de 12 a 128 caracteres." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const result = await env.DB.prepare(`
      INSERT INTO admin_users (email, password_hash)
      SELECT ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM admin_users
      )
    `)
      .bind(email, passwordHash)
      .run();

    if (!result.meta || result.meta.changes !== 1) {
      return Response.json(
        { error: "Já existe um administrador cadastrado." },
        { status: 409 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "Primeiro administrador criado com sucesso."
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    console.error("Erro ao criar administrador:", error);

    return Response.json(
      { error: "Não foi possível criar o administrador." },
      { status: 500 }
    );
  }
}
