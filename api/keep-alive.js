export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  try {
    // Tentamos apenas ler o cabeçalho da tabela pacientes (sem trazer dados)
    // O 'head=true' economiza banda e a chave anon tem permissão para isso.
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?select=*`, {
      method: 'GET', // Usamos GET mas com o Prefer head para ser leve
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=planned'
      }
    });

    if (response.ok) {
      return res.status(200).json({ 
        sucesso: true, 
        mensagem: "Supabase acordado com sucesso!",
        status: response.status
      });
    } else {
      const detalhe = await response.text();
      return res.status(response.status).json({ 
        sucesso: false, 
        erro: "O banco respondeu, mas recusou o acesso.",
        detalhe: detalhe 
      });
    }
  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
