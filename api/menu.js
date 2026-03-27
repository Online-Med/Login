export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  try {
    // Buscamos as colunas exatamente como aparecem no seu print da tabela
    const url = `${SUPABASE_URL}/rest/v1/menu?select=Ordem,pagina,descricao,icone&order=Ordem.asc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const rawData = await response.json();

    // Se o Supabase retornar um erro (ex: coluna não encontrada), ele vem num objeto 'error'
    if (rawData.error || !Array.isArray(rawData)) {
      return res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro no banco de dados", 
        detalhes: rawData.message || rawData 
      });
    }

    // Padronização: Transformamos 'Ordem' em 'ordem' para o Dashboard não quebrar
    const menuFinal = rawData.map(item => ({
      ordem: item.Ordem,           // Mapeia de 'Ordem' (banco) para 'ordem' (frontend)
      pagina: item.pagina,
      descricao: item.descricao,
      icone: item.icone || 'bi-folder2'
    }));

    return res.status(200).json(menuFinal);

  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
}
