const { SUPABASE_URL, SERVICE_KEY, gerarSenhaAleatoria, buscarConfig } = require('./_seguranca.js');
const nodemailer = require('nodemailer');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ sucesso: false, mensagem: "E-mail obrigatório." });

  try {
    // 1. Busca usuário e verifica se existe + trava de tempo
    const resUser = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${email.trim()}&select=id,ultimo_reset_at`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const usuarios = await resUser.json();

    if (!usuarios || usuarios.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: "E-mail não cadastrado no sistema." });
    }

    const usuario = usuarios[0];

    // 2. Valida trava de 15 minutos
    if (usuario.ultimo_reset_at) {
      const ultimaVez = new Date(usuario.ultimo_reset_at);
      const agora = new Date();
      const difMinutos = (agora - ultimaVez) / (1000 * 60);

      if (difMinutos < 15) {
        const falta = Math.ceil(15 - difMinutos);
        return res.status(429).json({ 
          sucesso: false, 
          mensagem: `Aguarde ${falta} minutos para solicitar uma nova senha novamente.` 
        });
      }
    }

    // 3. Busca credenciais de e-mail na tabela de configuracoes
    const gmailUser = await buscarConfig('email_cadastrado');
    const gmailPass = await buscarConfig('email_senha_api');

    if (!gmailUser || !gmailPass) {
      throw new Error("Configurações de e-mail não encontradas no banco.");
    }

    // 4. Gera nova senha e prepara Update
    const novaSenha = gerarSenhaAleatoria();
    const senhaHash = "HASH_" + Buffer.from(novaSenha).toString('base64');

    // 5. Atualiza Banco (Senha + Timestamp)
    await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${usuario.id}`, {
      method: 'PATCH',
      headers: { 
        'apikey': SERVICE_KEY, 
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        senha: senhaHash, 
        ultimo_reset_at: new Date().toISOString() 
      })
    });

    // 6. Envio do E-mail via Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass }
    });

    await transporter.sendMail({
      from: `"Suporte Online-Med" <${gmailUser}>`,
      to: email.trim(),
      subject: 'Recuperação de Acesso - Online-Med',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Sua nova senha chegou!</h2>
          <p>Você solicitou a recuperação de senha para o sistema <strong>Online-Med</strong>.</p>
          <p>Sua nova senha temporária é: <span style="font-size: 1.2em; color: #0089a5; font-weight: bold;">${novaSenha}</span></p>
          <hr>
          <p><small>Se você não solicitou esta alteração, ignore este e-mail.</small></p>
        </div>`
    });

    return res.status(200).json({ sucesso: true, mensagem: "E-mail enviado com sucesso!" });

  } catch (error) {
    console.error("Erro na recuperação:", error.message);
    return res.status(500).json({ sucesso: false, mensagem: "Erro técnico: " + error.message });
  }
}
