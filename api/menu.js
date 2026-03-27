export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  try {
    // Note que agora as colunas batem com o seu último print: Ordem, pagina, descricao, icone
    const url = `${SUPABASE_URL}/rest/v1/menu?select=Ordem,pagina,descricao,icone&order=Ordem.asc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const rawData = await response.json();

    // Verificação de segurança: se o banco retornar erro ou não for uma lista
    if (rawData.error || !Array.isArray(rawData)) {
      console.error("Erro do Supabase:", rawData);
      return res.status(500).json({ erro: "Erro ao ler tabela menu", detalhes: rawData });
    }

    // Padronizamos para o Dashboard.html
    const dadosFormatados = rawData.map(item => ({
      ordem: item.Ordem,      
      pagina: item.pagina,    
      descricao: item.descricao, 
      icone: item.icone || 'bi-folder2'
    }));

    return res.status(200).json(dadosFormatados);
  } catch (error) {
    console.error("Erro interno na API:", error.message);
    return res.status(500).json({ erro: error.message });
  }
}
