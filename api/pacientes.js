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
      const { pcod, nome, documento, celular, pagina } = query;
      
      // Configuração de Paginação (10 itens por página)
      const itensPorPagina = 10;
      const de = (parseInt(pagina) || 0) * itensPorPagina;
      const ate = de + (itensPorPagina - 1);

      // Se buscar por um PCOD específico (para edição)
      if (pcod) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?select=*&pcod=eq.${pcod}`, { headers });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, paciente: d[0] });
      }

      // Montagem da URL com Filtros
      let urlFiltro = `${SUPABASE_URL}/rest/v1/pacientes?select=*&order=pcod.desc`;
      if (nome) urlFiltro += `&Nome=ilike.*${nome}*`;
      if (documento) urlFiltro += `&Documento=ilike.*${documento}*`;
      if (celular) urlFiltro += `&Celular=ilike.*${celular}*`;

      // Chamada ao Supabase solicitando o Range (fatiamento) e o Count (total)
      const r = await fetch(urlFiltro, { 
        headers: { 
          ...headers, 
          'Range': `${de}-${ate}`,
          'Prefer': 'count=exact' // Força o Supabase a contar o total de registros
        } 
      });
      
      const d = await r.json();
      
      // Extrai o total de registros do cabeçalho "Content-Range" (ex: 0-9/1456)
      const contentRange = r.headers.get('content-range');
      const totalRegistros = contentRange ? parseInt(contentRange.split('/')[1]) : d.length;

      return res.status(200).json({ 
        sucesso: true, 
        dados: d, 
        total: totalRegistros,
        paginas: Math.ceil(totalRegistros / itensPorPagina)
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
