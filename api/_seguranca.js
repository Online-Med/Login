// ════════════════════════════════════════════════════════════════════
//  api/_seguranca.js
//  ⚠️  ESTE ARQUIVO USA ES MODULES — NÃO ADICIONE module.exports AQUI
//  O underscore no nome impede que o Vercel exponha como rota pública.
//  Coloque este arquivo DENTRO da pasta api/ junto com os outros .js
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

// ── Valida sessão: checa se o e-mail do header existe na tabela usuarios ──
// Lança erro se não autorizado. Use em TODOS os handlers exceto login e keep-alive.
export async function validarSessao(req) {
  const userEmail = (req.headers['x-user-email'] || '').trim().toLowerCase();
  if (!userEmail) throw new Error("Não autorizado: sessão ausente");

  const { ok, data } = await sb(
    `usuarios?email=eq.${encodeURIComponent(userEmail)}&select=id_profissional,perfil&limit=1`
  );
  if (!ok || !data || data.length === 0) throw new Error("Acesso negado");
  return data[0]; // { id_profissional, perfil }
}

// ── Gera uma senha aleatória segura (usada no recuperar.js) ──────
export function gerarSenhaAleatoria(tamanho = 10) {
  const maiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I e O (confusos)
  const minusculas = 'abcdefghjkmnpqrstuvwxyz';  // sem l e o
  const digitos    = '23456789';                  // sem 0 e 1
  const especiais  = '@#$%&*!';
  const todos      = maiusculas + minusculas + digitos + especiais;

  // Garante pelo menos 1 de cada categoria
  let senha = '';
  senha += maiusculas[Math.floor(Math.random() * maiusculas.length)];
  senha += minusculas[Math.floor(Math.random() * minusculas.length)];
  senha += digitos   [Math.floor(Math.random() * digitos.length)];
  senha += especiais [Math.floor(Math.random() * especiais.length)];

  for (let i = senha.length; i < tamanho; i++) {
    senha += todos[Math.floor(Math.random() * todos.length)];
  }

  // Embaralha para os caracteres garantidos não ficarem sempre no início
  return senha.split('').sort(() => Math.random() - 0.5).join('');
}

// ── Busca configurações ─────────────────────────────────────────────
//
// USO 1 — por id_profissional (retorna objeto { chave: valor }):
//   const cfg = await buscarConfig(3);
//   cfg.horario_inicio_agenda  →  '08:00'
//
// USO 2 — por chave global (retorna o valor como string):
//   const email = await buscarConfig('email_cadastrado');
//   email  →  'suporte@clinica.com'
//
export async function buscarConfig(idOuChave) {
  if (typeof idOuChave === 'string') {
    // Chave global — devolve só o valor
    const { ok, data } = await sb(
      `configuracoes?chave_config=eq.${encodeURIComponent(idOuChave)}&select=valor&limit=1`
    );
    if (!ok || !data || data.length === 0) return null;
    return data[0].valor;
  }

  // id_profissional — devolve objeto { chave: valor }
  const { ok, data } = await sb(
    `configuracoes?id_profissional=eq.${idOuChave}&select=chave_config,valor`
  );
  if (!ok || !data) return {};
  const cfg = {};
  data.forEach(row => { cfg[row.chave_config] = row.valor; });
  return cfg;
}
