export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";
  const { method, query } = req;

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // --- LISTAR PACIENTES (GET) ---
    if (method === 'GET') {
      const { pcod, nome, documento, celular } = query;

      // Se buscar por um PCOD específico (para edição)
      if (pcod) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?select=*&pcod=eq.${pcod}`, { headers });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, paciente: d[0] });
      }

      // Lógica de Filtros para a Lista
      let urlFiltro = `${SUPABASE_URL}/rest/v1/pacientes?select=*&order=pcod.desc&limit=50`;
      if (nome) urlFiltro += `&Nome=ilike.*${nome}*`;
      if (documento) urlFiltro += `&Documento=ilike.*${documento}*`;
      if (celular) urlFiltro += `&Celular=ilike.*${celular}*`;

      const r = await fetch(urlFiltro, { headers });
      const d = await r.json();

      // O front-end espera 'sucesso', 'dados' e 'total'
      return res.status(200).json({ 
        sucesso: true, 
        dados: d, 
        total: d.length,
        paginas: 1 
      });
    }

    // --- RESERVAR NOVO (POST) ---
    if (method === 'POST') {
      const rMax = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?select=pcod&order=pcod.desc&limit=1`, { headers });
      const ultimo = await rMax.json();
      const novoPcod = (ultimo.length > 0) ? (parseInt(ultimo[0].pcod) + 1) : 1;

      const reserva = { 
        pcod: novoPcod, 
        Nome: "RESERVADO - AGUARDANDO DADOS",
        Data_Cadastro: new Date().toISOString() 
      };
      
      await fetch(`${SUPABASE_URL}/rest/v1/pacientes`, { 
        method: 'POST', 
        headers, 
        body: JSON.stringify(reserva) 
      });
      
      return res.status(200).json({ sucesso: true, pcod: novoPcod });
    }

    // --- SALVAR/ATUALIZAR (PATCH) ---
    if (method === 'PATCH') {
      const { pcod } = query;
      await fetch(`${SUPABASE_URL}/rest/v1/pacientes?pcod=eq.${pcod}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(req.body)
      });
      return res.status(200).json({ sucesso: true });
    }

    // --- EXCLUIR (DELETE) ---
    if (method === 'DELETE') {
      const { pcod } = query;
      await fetch(`${SUPABASE_URL}/rest/v1/pacientes?pcod=eq.${pcod}`, { method: 'DELETE', headers });
      return res.status(200).json({ sucesso: true });
    }

  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
