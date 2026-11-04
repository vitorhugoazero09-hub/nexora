import { requireAdmin } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);

  if (admin instanceof Response) {
    return admin;
  }

  return Response.json({
    success: true,
    authenticated: true,
    email: admin.email
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
