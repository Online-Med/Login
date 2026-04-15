// api/convenios.js
import { SUPABASE_URL, sbHeaders, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  // 1. Proteção de Sessão
  try { 
    await validarSessao(req); 
  } catch (e) { 
    return res.status(401).json({ erro: e.message }); 
  }

  const { method, query } = req;

  try {
    // --- BUSCAR CONVÊNIOS ---
    if (method === 'GET') {
      const { id, nome } = query;

      // Se pedir um ID específico (para edição)
      if (id) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?select=*&id=eq.${id}`, { headers: sbHeaders });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, convenio: d[0] });
      }

      // Listagem geral
      let url = `${SUPABASE_URL}/rest/v1/convenios?select=*&order=CONVENIO.asc`;
      
      // Filtro de busca por nome (se houver)
      if (nome) url += `&CONVENIO=ilike.*${nome}*`;

      const r = await fetch(url, { headers: sbHeaders });
      const d = await r.json();
      return res.status(200).json({ sucesso: true, dados: d });
    }

// --- CRIAR NOVO CONVÊNIO (POST) ---
    if (method === 'POST') {
      const reserva = { 
        CONVENIO: "NOVO CONVÊNIO" 
      };

      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios`, { 
        method: 'POST', 
        headers: { 
          ...sbHeaders, 
          'Prefer': 'return=representation' // <--- OBRIGATÓRIO para o Supabase devolver o ID criado
        }, 
        body: JSON.stringify(reserva) 
      });
      
      const d = await r.json();
      
      // Verifica se o Supabase devolveu o dado e extrai o ID
      if (d && d.length > 0) {
        return res.status(200).json({ sucesso: true, id: d[0].id });
      } else {
        throw new Error("Erro ao criar reserva no banco.");
      }
    }

    // --- ATUALIZAR CONVÊNIO ---
    if (method === 'PATCH') {
      const { id } = query;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?id=eq.${id}`, { 
        method: 'PATCH', 
        headers: { ...sbHeaders, 'Prefer': 'return=representation' }, 
        body: JSON.stringify(body) 
      });

      return r.ok ? res.status(200).json({ sucesso: true }) : res.status(400).json({ sucesso: false, erro: "Erro ao atualizar convênio." });
    }

    // --- DELETAR CONVÊNIO ---
    if (method === 'DELETE') {
      const { id } = query;
      await fetch(`${SUPABASE_URL}/rest/v1/convenios?id=eq.${id}`, { method: 'DELETE', headers: sbHeaders });
      return res.status(200).json({ sucesso: true });
    }

  } catch (error) {
    console.error("Erro em convenios.js:", error.message);
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
