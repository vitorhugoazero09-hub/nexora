
import { requireAdmin } from "./_auth.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

// Buscar todas as candidaturas
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  try {
    const { results } = await env.DB.prepare(`
      SELECT
        id,
        full_name,
        email,
        phone,
        business_name,
        product_description,
        social_link,
        status,
        admin_notes,
        created_at,
        reviewed_at
      FROM producer_applications
      ORDER BY
        CASE status
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          ELSE 2
        END,
        created_at DESC
    `).all();

    return json({
      success: true,
      applications: results
    });

  } catch (error) {
    return json({
      success: false,
      error: "Erro ao buscar candidaturas."
    }, 500);
  }
}

// Aprovar ou rejeitar uma candidatura
export async function onRequestPut({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  try {
    const data = await request.json();

    const id = Number(data.id);
    const status = String(data.status || "").trim();
    const adminNotes = typeof data.admin_notes === "string"
      ? data.admin_notes.trim().slice(0, 2000)
      : "";

    if (!Number.isInteger(id) || id <= 0) {
      return json({
        success: false,
        error: "ID da candidatura inválido."
      }, 400);
    }

    if (!["approved", "rejected"].includes(status)) {
      return json({
        success: false,
        error: "Status inválido."
      }, 400);
    }

    const result = await env.DB.prepare(`
      UPDATE producer_applications
      SET
        status = ?,
        admin_notes = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(status, adminNotes, id).run();

    if (!result.meta.changes) {
      return json({
        success: false,
        error: "Candidatura não encontrada."
      }, 404);
    }

    return json({
      success: true,
      message: status === "approved"
        ? "Candidatura aprovada com sucesso."
        : "Candidatura rejeitada com sucesso."
    });

  } catch (error) {
    return json({
      success: false,
      error: "Erro ao atualizar candidatura."
    }, 500);
  }
}

