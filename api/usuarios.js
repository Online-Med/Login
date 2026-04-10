export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG"; // Use sua chave de serviço se for lidar com senhas
  const { method, query } = req;

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // --- LISTAR USUÁRIOS (GET) ---
    if (method === 'GET') {
      const { id, nome, perfil } = query;

      let url = `${SUPABASE_URL}/rest/v1/usuarios?select=*&order=nome.asc`;

      if (id) {
        url = `${SUPABASE_URL}/rest/v1/usuarios?select=*&id_profissional=eq.${id}`;
        const r = await fetch(url, { headers });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, usuario: d[0] });
      }

      if (nome) url += `&nome=ilike.*${nome}*`;
      if (perfil) url += `&perfil=eq.${perfil}`;

      const r = await fetch(url, { headers });
      const d = await r.json();

      return res.status(200).json({ sucesso: true, dados: d });
    }

    // --- CRIAR RESERVA DE USUÁRIO (POST) ---
    if (method === 'POST') {
      // Busca o maior ID para incrementar
      const rMax = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=id_profissional&order=id_profissional.desc&limit=1`, { headers });
      const ultimo = await rMax.json();
      const novoId = (ultimo.length > 0) ? (parseInt(ultimo[0].id_profissional) + 1) : 1;

      const reserva = { 
        id_profissional: novoId, 
        nome: "NOVO USUÁRIO - AGUARDANDO DADOS",
        email: `temp_${novoId}@med.com`, // Email temporário para evitar erro de NOT NULL
        perfil: "RECEPCAO",
        tem_agenda: "NÃO"
      };

      const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, { 
        method: 'POST', 
        headers: { ...headers, 'Prefer': 'return=representation' }, 
        body: JSON.stringify(reserva) 
      });

      return res.status(200).json({ sucesso: true, id_profissional: novoId });
    }

    // --- ATUALIZAR DADOS (PATCH) ---
    if (method === 'PATCH') {
      const { id } = query;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id_profissional=eq.${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(req.body)
      });
      
      return r.ok ? res.status(200).json({ sucesso: true }) : res.status(400).json({ sucesso: false, erro: "Erro ao atualizar usuário." });
    }

    // --- EXCLUIR USUÁRIO (DELETE) ---
    if (method === 'DELETE') {
      const { id } = query;
      await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id_profissional=eq.${id}`, { 
        method: 'DELETE', 
        headers 
      });
      return res.status(200).json({ sucesso: true });
    }

  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
