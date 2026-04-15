// api/convenios.js
import { SUPABASE_URL, sbHeaders, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  try { 
    await validarSessao(req); 
  } catch (e) { 
    return res.status(401).json({ erro: e.message }); 
  }

  const { method, query } = req;

  try {
    if (method === 'GET') {
      const { id, nome } = query;
      const url = new URL(`${SUPABASE_URL}/rest/v1/convenios`);
      url.searchParams.set('select', '*');

      if (id) {
        url.searchParams.set('id', `eq.${id}`);
        const r = await fetch(url.toString(), { headers: sbHeaders });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, convenio: d[0] });
      }

      url.searchParams.set('order', 'CONVENIO.asc');
      if (nome) url.searchParams.set('CONVENIO', `ilike.*${nome}*`);

      const r = await fetch(url.toString(), { headers: sbHeaders });
      const d = await r.json();
      return res.status(200).json({ sucesso: true, dados: d });
    }

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
      
      if (Array.isArray(d) && d.length > 0) {
        return res.status(200).json({ sucesso: true, id: d[0].id });
      } else {
        return res.status(400).json({ sucesso: false, erro: "Erro ao criar reserva no banco." });
      }
    }

    if (method === 'PATCH') {
      const { id } = query;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?id=eq.${id}`, { 
        method: 'PATCH', 
        headers: { ...sbHeaders, 'Prefer': 'return=representation' }, 
        body: JSON.stringify(body) 
      });
      return res.status(200).json({ sucesso: r.ok });
    }

    if (method === 'DELETE') {
      const { id } = query;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?id=eq.${id}`, { method: 'DELETE', headers: sbHeaders });
      return res.status(200).json({ sucesso: r.ok });
    }

  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
