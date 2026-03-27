export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  try {
    // Busca os dados - note que usei as aspas para garantir que o Supabase entenda as maiúsculas
    const url = `${SUPABASE_URL}/rest/v1/menu?select=ORDEM,pagina,Descricao,icone&order=ORDEM.asc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const rawData = await response.json();

    // Padronizamos para minúsculo aqui para o Dashboard não dar erro
    const dadosFormatados = rawData.map(item => ({
      ordem: item.ORDEM,
      pagina: item.pagina,
      descricao: item.Descricao,
      icone: item.icone || 'bi-folder2' // Ícone padrão se estiver vazio
    }));

    return res.status(200).json(dadosFormatados);
  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
