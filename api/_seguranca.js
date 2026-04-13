// api/_seguranca.js
// Arquivo com underscore → Vercel NÃO expõe como rota pública.
// Centraliza credenciais e validação de sessão para todas as APIs.

export const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
export const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpanltbXlodGp2Z2ZucGF6and3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIwMDgxMCwiZXhwIjoyMDg5Nzc2ODEwfQ.VA6bhNcYV2y95tuUZh8W94jCy4d8bh-bDFXcLYI2LVM";

// Headers padrão para todas as chamadas ao Supabase
export const sbHeaders = {
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type':  'application/json'
};

// ── Helper genérico para chamar o Supabase ────────────────────────
export async function sb(path, method = 'GET', body = null, extraHeaders = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...sbHeaders, ...extraHeaders },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: r.ok, status: r.status, data };
}

// ── Valida se o e-mail do header pertence a um usuário cadastrado ──
// Lança erro se inválido. Use em todos os handlers exceto login e keep-alive.
export async function validarSessao(req) {
  const userEmail = (req.headers['x-user-email'] || '').trim().toLowerCase();
  if (!userEmail) throw new Error("Não autorizado: sessão ausente");

  const { ok, data } = await sb(
    `usuarios?email=eq.${encodeURIComponent(userEmail)}&select=id_profissional,perfil&limit=1`
  );
  if (!ok || !data || data.length === 0) throw new Error("Acesso negado");
  return data[0]; // retorna { id_profissional, perfil } do usuário logado
}
