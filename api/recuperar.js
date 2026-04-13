import { SUPABASE_URL, SERVICE_KEY, gerarSenhaAleatoria, buscarConfig } from './_seguranca.js';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ sucesso: false, mensagem: "E-mail obrigatório." });

  // Headers administrativos (Service Key) para ignorar RLS e atualizar a senha
  const adminHeaders = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Busca usuário e verifica existência + timestamp da última solicitação
    const resUser = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${email.trim()}&select=id,ultimo_reset_at`, {
      headers: adminHeaders
    });
    const usuarios = await resUser.json();

    // Trava: Se não achar o e-mail, para aqui (evita spam para endereços aleatórios)
    if (!usuarios || usuarios.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: "E-mail não cadastrado no sistema." });
    }

    const usuario = usuarios[0];

    // 2. Trava de Segurança: 15 minutos
    if (usuario.ultimo_reset_at) {
      const ultimaVez = new Date(usuario.ultimo_reset_at);
      const agora = new Date();
      const difMinutos = (agora - ultimaVez) / (1000 * 60);

      if (difMinutos < 15) {
        const falta = Math.ceil(15 - difMinutos);
        return res.status(429).json({ 
          sucesso: false, 
          mensagem: `Aguarde ${falta} minutos para tentar novamente.` 
        });
      }
    }

    // 3. Pega credenciais do Gmail na sua tabela de configurações
    const gmailUser = await buscarConfig('email_cadastrado');
    const gmailPass = await buscarConfig('email_senha_api');

    if (!gmailUser || !gmailPass) {
      throw new Error("Configurações de e-mail ausentes na tabela configuracoes.");
    }

    // 4. Gera senha nova e Hash
    const novaSenha = gerarSenhaAleatoria();
    const senhaHash = "HASH_" + Buffer.from(novaSenha).toString('base64');

    // 5. Atualiza no Banco: Nova senha e atualiza o tempo do reset
    await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${usuario.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ 
        senha: senhaHash, 
        ultimo_reset_at: new Date().toISOString() 
      })
    });

    // 6. Envio via Nodemailer usando os dados do seu banco
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass }
    });

    await transporter.sendMail({
      from: `"Suporte Online-Med" <${gmailUser}>`,
      to: email.trim(),
      subject: '🔑 Recuperação de Acesso - Online-Med',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #0089a5;">Nova senha gerada</h2>
          <p>Olá, identificamos sua solicitação de recuperação de senha.</p>
          <p>Sua nova senha de acesso é:</p>
          <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #333; border-radius: 5px;">
            ${novaSenha}
          </div>
          <p style="margin-top: 20px; font-size: 13px; color: #666;">
            <strong>Aviso:</strong> Por segurança, você só poderá solicitar um novo reset em 15 minutos.
          </p>
        </div>`
    });

    return res.status(200).json({ sucesso: true, mensagem: "Sua nova senha foi enviada para o e-mail informado." });

  } catch (error) {
    console.error("Erro técnico:", error.message);
    return res.status(500).json({ sucesso: false, mensagem: "Erro ao processar recuperação." });
  }
}
