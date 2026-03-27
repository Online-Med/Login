export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  try {
    // Pegamos tudo (*) para evitar erro de "coluna não encontrada"
    const url = `${SUPABASE_URL}/rest/v1/menu?select=*`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
      return res.status(500).json({ erro: "Erro ao acessar o banco", detalhes: rawData });
    }

    // Aqui está a mágica: o código tenta ler 'Ordem' ou 'ordem' (minúsculo)
    // O que ele encontrar primeiro, ele usa.
    const menuTratado = rawData.map(item => {
      return {
        ordem: item.ordem || item.Ordem || item.ORDEM,
        descricao: item.descricao || item.Descricao || item.Descrição,
        pagina: item.pagina || item.Pagina,
        icone: item.icone || 'bi-folder2'
      };
    });

    // Ordena os itens pela coluna ordem
    menuTratado.sort((a, b) => String(a.ordem).localeCompare(String(b.ordem), undefined, {numeric: true}));

    return res.status(200).json(menuTratado);

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
