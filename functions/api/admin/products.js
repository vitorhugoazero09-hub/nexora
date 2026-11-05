import { requireAdmin } from "./_auth.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  try {
    const { results } = await env.DB.prepare(`
      SELECT id, title, description, category, price,
             cover, checkout_url, active, created_at, updated_at
      FROM products
      ORDER BY created_at DESC
    `).all();

    return json({ success: true, products: results });
  } catch (error) {
    return json({ success: false, error: "Erro ao buscar produtos." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  try {
    const data = await request.json();

    const title = String(data.title || "").trim();
    const description = String(data.description || "").trim();
    const category = String(data.category || "").trim();
    const price = Number(data.price);
    const cover = String(data.cover || "").trim();
    const checkoutUrl = String(data.checkout_url || "").trim();

    if (!title || !category || !Number.isFinite(price) || price < 0) {
      return json({
        success: false,
        error: "Informe título, categoria e preço válido."
      }, 400);
    }

    const result = await env.DB.prepare(`
      INSERT INTO products
        (title, description, category, price, cover, checkout_url, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(
      title, description, category, price, cover, checkoutUrl
    ).run();

    return json({
      success: true,
      message: "Produto cadastrado.",
      id: result.meta.last_row_id
    }, 201);
  } catch (error) {
    return json({ success: false, error: "Erro ao cadastrar produto." }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  try {
    const data = await request.json();
    const id = Number(data.id);
    const title = String(data.title || "").trim();
    const description = String(data.description || "").trim();
    const category = String(data.category || "").trim();
    const price = Number(data.price);
    const cover = String(data.cover || "").trim();
    const checkoutUrl = String(data.checkout_url || "").trim();
    const active = data.active === false || data.active === 0 ? 0 : 1;

    if (!Number.isInteger(id) || id <= 0 || !title || !category ||
        !Number.isFinite(price) || price < 0) {
      return json({ success: false, error: "Dados inválidos." }, 400);
    }

    const result = await env.DB.prepare(`
      UPDATE products
      SET title = ?, description = ?, category = ?, price = ?,
          cover = ?, checkout_url = ?, active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      title, description, category, price,
      cover, checkoutUrl, active, id
    ).run();

    if (!result.meta.changes) {
      return json({ success: false, error: "Produto não encontrado." }, 404);
    }

    return json({ success: true, message: "Produto atualizado." });
  } catch (error) {
    return json({ success: false, error: "Erro ao atualizar produto." }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  try {
    const data = await request.json();
    const id = Number(data.id);

    if (!Number.isInteger(id) || id <= 0) {
      return json({ success: false, error: "ID inválido." }, 400);
    }

    const result = await env.DB.prepare(
      "DELETE FROM products WHERE id = ?"
    ).bind(id).run();

    if (!result.meta.changes) {
      return json({ success: false, error: "Produto não encontrado." }, 404);
    }

    return json({ success: true, message: "Produto excluído." });
  } catch (error) {
    return json({ success: false, error: "Erro ao excluir produto." }, 500);
  }
}
