export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  try {
    // Em vez de consultar uma tabela, vamos apenas pedir as definições da API
    // Isso é suficiente para o Supabase considerar como atividade.
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (response.ok) {
      return res.status(200).json({ 
        sucesso: true, 
        mensagem: "Supabase acordado!",
        timestamp: new Date().toISOString()
      });
    } else {
      const erroTexto = await response.text();
      return res.status(response.status).json({ 
        sucesso: false, 
        erro: "Supabase recusou a conexão",
        detalhe: erroTexto 
      });
    }
  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
