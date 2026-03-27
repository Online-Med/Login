export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    // A Vercel às vezes já entrega o corpo como objeto, às vezes como string.
    // Esse ajuste abaixo resolve o erro [object Object]
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, senha } = body;

    if (!email || !senha) {
       return res.status(400).json({ sucesso: false, mensagem: "E-mail e senha são obrigatórios." });
    }

    const emailLimpo = email.trim();
    const senhaHash = "HASH_" + Buffer.from(senha).toString('base64');
    const url = `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${emailLimpo}&select=*`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const dados = await response.json();

    if (dados && dados.length > 0) {
      if (dados[0].senha === senhaHash) {
        return res.status(200).json({ sucesso: true, usuario: dados[0].nome || emailLimpo });
      } else {
        return res.status(401).json({ sucesso: false, mensagem: "Senha incorreta." });
      }
    } else {
      return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado." });
    }
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: "Erro técnico: " + error.message });
  }
}
