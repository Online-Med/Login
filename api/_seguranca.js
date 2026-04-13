// ════════════════════════════════════════════════════════════════════
//  api/_seguranca.js
//  ⚠️  ESTE ARQUIVO USA ES MODULES — NÃO ADICIONE module.exports AQUI
// ════════════════════════════════════════════════════════════════════

export const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";

// Chave de serviço (service_role) — bypassa RLS no Supabase
export const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpanltbXlodGp2Z2ZucGF6and3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIwMDgxMCwiZXhwIjoyMDg5Nzc2ODEwfQ.VA6bhNcYV2y95tuUZh8W94jCy4d8bh-bDFXcLYI2LVM";

// Headers prontos para usar em qualquer chamada ao Supabase
export const sbHeaders = {
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type':  'application/json'
};

// ── Helper: chama o Supabase REST e retorna { ok, status, data } ──
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

// ── Valida sessão ──
export async function validarSessao(req) {
  const userEmail = (req.headers['x-user-email'] || '').trim().toLowerCase();
  if (!userEmail) throw new Error("Não autorizado: sessão ausente");

  const { ok, data } = await sb(
    `usuarios?email=eq.${encodeURIComponent(userEmail)}&select=id_profissional,perfil&limit=1`
  );
  if (!ok || !data || data.length === 0) throw new Error("Acesso negado");
  return data[0];
}

// ✅ ADICIONADO 'export' AQUI
export function gerarSenhaAleatoria() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*";
  let senha = "";
  for (let i = 0; i < 8; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
}

// ✅ ADICIONADO 'export' AQUI
export async function buscarConfig(chave) {
  const url = `${SUPABASE_URL}/rest/v1/configuracoes?chave_config=eq.${chave}&select=valor`;
  const res = await fetch(url, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const dados = await res.json();
  return dados.length > 0 ? dados[0].valor : null;
}

// ❌ REMOVIDO: module.exports (Isso causa erro em ES Modules)
