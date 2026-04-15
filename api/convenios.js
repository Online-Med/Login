import { SUPABASE_URL, sbHeaders, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  try { await validarSessao(req); } catch (e) { return res.status(401).json({ erro: e.message }); }

  const { method, query } = req;

  try {
    if (method === 'GET') {
      const { id } = query;
      const url = id 
        ? `${SUPABASE_URL}/rest/v1/convenios?select=*&id=eq.${id}`
        : `${SUPABASE_URL}/rest/v1/convenios?select=*&order=CONVENIO.asc`;
      
      const r = await fetch(url, { headers: sbHeaders });
      const d = await r.json();
      return res.status(200).json(id ? { sucesso: true, convenio: d[0] } : { sucesso: true, dados: d });
    }

    if (method === 'POST') {
      // Tenta inserir. Se falhar, é porque o banco exige ID manual.
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios`, { 
        method: 'POST', 
        headers: { ...sbHeaders, 'Prefer': 'return=representation' }, 
        body: JSON.stringify({ CONVENIO: "NOVO" }) 
      });
      
      const d = await r.json();
      if (Array.isArray(d) && d.length > 0) return res.status(200).json({ sucesso: true, id: d[0].id });
      
      return res.status(400).json({ sucesso: false, erro: "Erro: Ative o 'Autoincrement' no ID da tabela convenio no Supabase." });
    }

    if (method === 'PATCH') {
      const { id } = query;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?id=eq.${id}`, { 
        method: 'PATCH', 
        headers: { ...sbHeaders, 'Prefer': 'return=representation' }, 
        body: JSON.stringify(req.body) 
      });
      return res.status(200).json({ sucesso: r.ok });
    }

    if (method === 'DELETE') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?id=eq.${query.id}`, { method: 'DELETE', headers: sbHeaders });
      return res.status(200).json({ sucesso: r.ok });
    }
  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
