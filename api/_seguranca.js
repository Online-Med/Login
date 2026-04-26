// ════════════════════════════════════════════════════════════════════
//  api/_seguranca.js
//  ⚠️  ESTE ARQUIVO USA ES MODULES — NÃO ADICIONE module.exports AQUI
//  O underscore no nome impede que o Vercel exponha como rota pública.
//  Coloque este arquivo DENTRO da pasta api/ junto com os outros .js
// ════════════════════════════════════════════════════════════════════
// api/_seguranca.js
// Versão mais resiliente — substitua seu arquivo por este

export const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";

// Use a service role key do Supabase (defina SUPABASE_SERVICE_ROLE_KEY no Vercel)
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Não logue SERVICE_KEY no console (evita vazar segredo).
console.log('[seguranca] SERVICE_KEY present:', !!SERVICE_KEY);
console.log('[seguranca] global.fetch available:', typeof fetch !== 'undefined');

let _fetch = (typeof fetch !== 'undefined') ? fetch : null;
if (!_fetch) {
  try {
    // fallback para node-fetch se necessário
    // no ambiente Vercel moderno normalmente não é necessário
    const nodeFetch = await import('node-fetch');
    _fetch = nodeFetch.default;
    console.log('[seguranca] using node-fetch fallback');
  } catch (e) {
    console.warn('[seguranca] fetch não disponível e node-fetch não pôde ser importado');
  }
}

export const sbHeaders = {
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type':  'application/json'
};

// Helper: chama o Supabase REST e retorna { ok, status, data, error }
export async function sb(path, method = 'GET', body = null, extraHeaders = {}) {
  try {
    if (!_fetch) throw new Error('fetch não disponível no runtime');

    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const opts = {
      method,
      headers: { ...sbHeaders, ...extraHeaders },
      ...(body ? { body: JSON.stringify(body) } : {})
    };

    const r = await _fetch(url, opts);
    const status = r.status;
    const text = await r.text().catch(() => null);

    if (!text) {
      // corpo vazio (ex: 204)
      return { ok: r.ok, status, data: null };
    }

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // se não for JSON, devolve o texto cru
      data = text;
    }

    return { ok: r.ok, status, data };
  } catch (err) {
    console.error('[seguranca.sb] erro ao chamar Supabase:', err.message || err);
    return { ok: false, status: 0, data: null, error: err.message || String(err) };
  }
}

// Valida sessão: checa header x-user-email (mantive sua lógica)
// Retorna dados do usuário (e.g. { id_profissional, perfil }) ou lança erro
export async function validarSessao(req) {
  const userEmail = (req.headers['x-user-email'] || req.headers['X-User-Email'] || '').trim().toLowerCase();
  if (!userEmail) throw new Error("Não autorizado: sessão ausente");

  const encoded = encodeURIComponent(userEmail);
  const { ok, status, data, error } = await sb(
    `usuarios?email=eq.${encoded}&select=id_profissional,perfil&limit=1`
  );

  if (!ok) {
    const msg = `Erro ao validar sessão (status ${status}) ${error ? '- ' + error : ''}`;
    console.error('[seguranca.validarSessao]', msg);
    throw new Error("Acesso negado");
  }
  if (!data || data.length === 0) throw new Error("Acesso negado");

  return data[0];
}

// rest of helpers
export function gerarSenhaAleatoria(tamanho = 10) {
  const maiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghjkmnpqrstuvwxyz';
  const digitos    = '23456789';
  const especiais  = '@#$%&*!';
  const todos      = maiusculas + minusculas + digitos + especiais;
  let senha = '';
  senha += maiusculas[Math.floor(Math.random() * maiusculas.length)];
  senha += minusculas[Math.floor(Math.random() * minusculas.length)];
  senha += digitos[Math.floor(Math.random() * digitos.length)];
  senha += especiais[Math.floor(Math.random() * especiais.length)];
  for (let i = senha.length; i < tamanho; i++) senha += todos[Math.floor(Math.random() * todos.length)];
  return senha.split('').sort(() => Math.random() - 0.5).join('');
}

export async function buscarConfig(idOuChave) {
  if (typeof idOuChave === 'string') {
    const { ok, data } = await sb(
      `configuracoes?chave_config=eq.${encodeURIComponent(idOuChave)}&select=valor&limit=1`
    );
    if (!ok || !data || data.length === 0) return null;
    return data[0].valor;
  }
  const { ok, data } = await sb(
    `configuracoes?id_profissional=eq.${idOuChave}&select=chave_config,valor`
  );
  if (!ok || !data) return {};
  const cfg = {};
  data.forEach(row => { cfg[row.chave_config] = row.valor; });
  return cfg;
}
