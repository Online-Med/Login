export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";
  const { method, query } = req;

  try {
    // --- BUSCA/LISTAGEM ---
    if (method === 'GET') {
      const pcod = query.pcod;
      
      // Se tiver pcod, busca um paciente específico (Edição)
      if (pcod) {
        const url = `${SUPABASE_URL}/rest/v1/pacientes?select=*&pcod=eq.${pcod}&limit=1`;
        const response = await fetch(url, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
        const dados = await response.json();
        return res.status(200).json({ sucesso: true, paciente: dados[0] });
      }

      // Listagem geral com paginação
      const pagina = parseInt(query.pagina) || 0;
      const itensPorPagina = 10;
      const de = pagina * itensPorPagina;
      const ate = de + itensPorPagina - 1;

      let url = `${SUPABASE_URL}/rest/v1/pacientes?select=pcod,Nome,Documento,Celular,Telefone,Data_Nascimento&order=pcod.desc`;

      // Filtros simples
      if (query.nome) url += `&Nome=ilike.*${query.nome}*`;
      if (query.documento) url += `&Documento=ilike.*${query.documento}*`;

      const response = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Range': `${de}-${ate}`,
          'Prefer': 'count=exact'
        }
      });

      const dados = await response.json();
      const range = response.headers.get("content-range") || "0-0/0";
      const total = parseInt(range.split("/")[1]) || 0;

      return res.status(200).json({
        sucesso: true,
        dados: dados,
        total: total,
        paginas: Math.ceil(total / itensPorPagina)
      });
    }

    // --- ATUALIZAÇÃO (PATCH) ---
    if (method === 'PATCH') {
      const { pcod } = query;
      const url = `${SUPABASE_URL}/rest/v1/pacientes?pcod=eq.${pcod}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 
          'apikey': SUPABASE_KEY, 
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(req.body)
      });

      if (response.ok) return res.status(200).json({ sucesso: true });
      return res.status(response.status).json({ sucesso: false, erro: "Erro ao atualizar banco" });
    }

  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
}
