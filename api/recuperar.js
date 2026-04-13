const { SUPABASE_URL, SERVICE_KEY, gerarSenhaAleatoria } = require('./_seguranca.js');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ sucesso: false, mensagem: "E-mail é obrigatório." });

  try {
    // 1. Verifica se o usuário existe
    const resUser = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${email.trim()}&select=id`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const user = await resUser.json();

    if (!user || user.length === 0) {
      // Por segurança, evite dizer que o e-mail não existe. 
      return res.status(200).json({ sucesso: true, mensagem: "Se o e-mail existir, uma nova senha foi enviada." });
    }

    // 2. Gera nova senha e o Hash
    const novaSenha = gerarSenhaAleatoria();
    const senhaHash = "HASH_" + Buffer.from(novaSenha).toString('base64');

    // 3. Atualiza no Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${email.trim()}`, {
      method: 'PATCH',
      headers: { 
        'apikey': SERVICE_KEY, 
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ senha: senhaHash })
    });

    // 4. Envia o e-mail via RESEND
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer re_SUA_CHAVE_DO_RESEND_AQUI',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Online-Med <onboarding@resend.dev>', // No plano grátis use este remetente
        to: email.trim(),
        subject: 'Sua Nova Senha - Online-Med',
        html: `<strong>Olá!</strong><p>Sua senha foi resetada conforme solicitado.</p><p>Nova senha: <code>${novaSenha}</code></p><p>Recomendamos trocar após o login.</p>`
      })
    });

    return res.status(200).json({ sucesso: true, mensagem: "E-mail de recuperação enviado!" });

  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: "Erro técnico: " + error.message });
  }
}
