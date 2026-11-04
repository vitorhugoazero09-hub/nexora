const encoder = new TextEncoder();

function decodeBase64Url(value) {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";

  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

export async function verifySession(request, env) {
  try {
    if (!env.SESSION_SECRET) return null;

    const cookies = request.headers.get("Cookie") || "";
    const sessionCookie = cookies
      .split(";")
      .map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith("nexora_session="));

    if (!sessionCookie) return null;

    const token = sessionCookie.substring("nexora_session=".length);
    const parts = token.split(".");

    if (parts.length !== 2) return null;

    const [payload, signature] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env.SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature),
      encoder.encode(payload)
    );

    if (!validSignature) return null;

    const data = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(payload))
    );

    if (
      !data.email ||
      !data.exp ||
      data.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return { email: data.email };
  } catch {
    return null;
  }
}

export async function requireAdmin(request, env) {
  const admin = await verifySession(request, env);

  if (!admin) {
    return Response.json(
      { success: false, error: "Acesso não autorizado." },
      { status: 401 }
    );
  }

  return admin;
}
