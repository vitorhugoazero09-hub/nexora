
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    if (!db) {
      return Response.json(
        { error: "Banco de dados não conectado." },
        { status: 500 }
      );
    }

    const result = await db
      .prepare(`
        SELECT
          id,
          title,
          description,
          category,
          price,
          cover,
          checkout_url,
          active,
          created_at
        FROM products
        WHERE active = 1
        ORDER BY created_at DESC
      `)
      .all();

    return Response.json(
      {
        success: true,
        total: result.results.length,
        products: result.results
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    console.error("Erro ao buscar produtos:", error);

    return Response.json(
      { error: "Não foi possível carregar os produtos." },
      { status: 500 }
    );
  }
}
