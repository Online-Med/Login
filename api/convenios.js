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
    // --- BUSCAR CONVÊNIOS ---
    if (method === 'GET') {
      const { id } = query;
      if (id) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?select=*&id=eq.${id}`, { headers: sbHeaders });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, convenio: d[0] });
      }
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?select=*&order=CONVENIO.asc`, { headers: sbHeaders });
      const d = await r.json();
      return res.status(200).json({ sucesso: true, dados: d });
    }

    // --- NOVO REGISTRO COM MAX(ID) + 1 ---
    if (method === 'POST') {
      // 1. Busca o maior ID atual
      const resMax = await fetch(`${SUPABASE_URL}/rest/v1/convenios?select=id&order=id.desc&limit=1`, { headers: sbHeaders });
      const dadosMax = await resMax.json();
      
      // 2. Calcula o novo ID (Se a tabela estiver vazia, começa em 1)
      const novoId = (dadosMax.length > 0) ? parseInt(dadosMax[0].id) + 1 : 1;

      // 3. Insere a reserva com o ID manual
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios`, { 
        method: 'POST', 
        headers: { ...sbHeaders, 'Prefer': 'return=representation' }, 
        body: JSON.stringify({ id: novoId, CONVENIO: "RESERVA_PROVISORIA" }) 
      });
      
      const d = await r.json();
      if (d && d.length > 0) {
        return res.status(200).json({ sucesso: true, id: d[0].id });
      } else {
        return res.status(400).json({ sucesso: false, erro: "Erro ao inserir reserva manual." });
      }
    }

    // --- ATUALIZAR (ALTER) ---
    if (method === 'PATCH') {
      const { id } = query;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?id=eq.${id}`, { 
        method: 'PATCH', 
        headers: { ...sbHeaders }, 
        body: JSON.stringify(body) 
      });
      return res.status(200).json({ sucesso: r.ok });
    }

    // --- EXCLUIR (CANCELAR) ---
    if (method === 'DELETE') {
      const { id } = query;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?id=eq.${id}`, { method: 'DELETE', headers: sbHeaders });
      return res.status(200).json({ sucesso: r.ok });
    }

  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
