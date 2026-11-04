export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, title, description, category, price, cover, checkout_url FROM products WHERE active = 1 ORDER BY created_at DESC"
    ).all();

    return new Response(JSON.stringify({
      success: true,
      total: results.length,
      products: results
    }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: "Erro ao carregar produtos."
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  }
}
