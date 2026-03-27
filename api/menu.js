export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  try {
    // Busca o menu ordenado pela coluna 'ordem'
    const url = `${SUPABASE_URL}/rest/v1/menu?select=*&order=ordem.asc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const dados = await response.json();
    return res.status(200).json(dados);
  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
