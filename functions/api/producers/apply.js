
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function clean(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function onRequestPost({ request, env }) {
  try {
    let data;

    try {
      data = await request.json();
    } catch {
      return json({
        success: false,
        message: "Envie os dados em formato JSON."
      }, 400);
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return json({
        success: false,
        message: "Dados inválidos."
      }, 400);
    }

    const fullName = clean(data.full_name, 120);
    const email = clean(data.email, 254).toLowerCase();
    const phone = clean(data.phone, 30);
    const businessName = clean(data.business_name, 120);
    const productDescription = clean(data.product_description, 3000);
    const socialLink = clean(data.social_link, 500);

    if (!fullName || !email || !productDescription) {
      return json({
        success: false,
        message: "Preencha nome, e-mail e descrição dos produtos."
      }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({
        success: false,
        message: "Digite um e-mail válido."
      }, 400);
    }

    if (fullName.length < 2 || productDescription.length < 10) {
      return json({
        success: false,
        message: "Confira os dados informados."
      }, 400);
    }

    await env.DB.prepare(`
      INSERT INTO producer_applications (
        full_name,
        email,
        phone,
        business_name,
        product_description,
        social_link
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      fullName,
      email,
      phone || null,
      businessName || null,
      productDescription,
      socialLink || null
    ).run();

    return json({
      success: true,
      message: "Candidatura enviada com sucesso."
    }, 201);

  } catch (error) {
    const message = String(error?.message || error);

    if (message.includes("UNIQUE constraint failed")) {
      return json({
        success: false,
        message: "Já existe uma candidatura com esse e-mail."
      }, 409);
    }

    return json({
      success: false,
      message: "Não foi possível enviar sua candidatura."
    }, 500);
  }
}

