// api/convenios.js
import { SUPABASE_URL, sbHeaders, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  // 1. Validação de Sessão
  try { 
    await validarSessao(req); 
  } catch (e) { 
    return res.status(401).json({ erro: e.message }); 
  }

  const { method, query } = req;

  try {
    // --- BUSCAR CONVÊNIOS (GET) ---
    if (method === 'GET') {
      const { id, nome } = query;
      const url = new URL(`${SUPABASE_URL}/rest/v1/convenios`);

      if (id) {
        url.searchParams.set('select', '*');
        url.searchParams.set('id', `eq.${id}`);
        const r = await fetch(url.toString(), { headers: sbHeaders });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, convenio: d[0] });
      }

      url.searchParams.set('select', '*');
      url.searchParams.set('order', 'CONVENIO.asc');
      if (nome) {
        url.searchParams.set('CONVENIO', `ilike.*${nome}*`);
      }

      const r = await fetch(url.toString(), { headers: sbHeaders });
      const d = await r.json();
      return res.status(200).json({ sucesso: true, dados: d });
    }

    // --- RESERVAR ID (POST) ---
    if (method === 'POST') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios`, { 
        method: 'POST', 
        headers: { 
          ...sbHeaders, 
          'Prefer': 'return=representation' 
        }, 
        body: JSON.stringify({ CONVENIO: "NOVO CONVÊNIO" }) 
      });
      
      const d = await r.json();

      // Verifica se o retorno é um array e se o ID (minúsculo) existe
      if (Array.isArray(d) && d.length > 0) {
        return res.status(200).json({ sucesso: true, id: d[0].id });
      } 
      
      return res.status(400).json({ 
        sucesso: false, 
        erro: "O banco não retornou o ID. Verifique se a coluna se chama 'id' e se é autoincremento." 
      });
    }

    // --- ATUALIZAR (PATCH) ---
    if (method === 'PATCH') {
      const { id } = query;
      const url = new URL(`${SUPABASE_URL}/rest/v1/convenios`);
      url.searchParams.set('id', `eq.${id}`);

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const r = await fetch(url.toString(), {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(body)
      });

      return res.status(200).json({ sucesso: r.ok });
    }

    // --- EXCLUIR (DELETE) ---
    if (method === 'DELETE') {
      const { id } = query;
      const url = new URL(`${SUPABASE_URL}/rest/v1/convenios`);
      url.searchParams.set('id', `eq.${id}`);

      const r = await fetch(url.toString(), { 
        method: 'DELETE', 
        headers: sbHeaders 
      });

      return res.status(200).json({ sucesso: r.ok });
    }

  } catch (error) {
    console.error("Erro na API de Convênios:", error.message);
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
