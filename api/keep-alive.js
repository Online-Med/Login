export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  try {
    // Faz uma consulta super simples (só conta o primeiro registro da tabela menu)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/menu?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (response.ok) {
      return res.status(200).json({ sucesso: true, mensagem: "Supabase acordado com sucesso!" });
    } else {
      throw new Error("Falha ao comunicar com Supabase");
    }
  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
