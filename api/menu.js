export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  try {
    // Note que agora as colunas batem com o seu print: Ordem, pagina, descricao, icone
    const url = `${SUPABASE_URL}/rest/v1/menu?select=Ordem,pagina,descricao,icone&order=Ordem.asc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const rawData = await response.json();

    // Se houver erro na resposta do Supabase, logamos para depurar
    if (!Array.isArray(rawData)) {
      return res.status(500).json({ erro: "Dados inválidos do banco", detalhes: rawData });
    }

    // Padronizamos para o que o seu Dashboard.html espera (tudo minúsculo)
    const dadosFormatados = rawData.map(item => ({
      ordem: item.Ordem,      // Pega de 'Ordem' (conforme seu print)
      pagina: item.pagina,    // Pega de 'pagina'
      descricao: item.descricao, // Pega de 'descricao'
      icone: item.icone || 'bi-folder2'
    }));

    return res.status(200).json(dadosFormatados);
  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
