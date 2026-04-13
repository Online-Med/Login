import { SUPABASE_URL, SERVICE_KEY, gerarSenhaAleatoria, buscarConfig } from './_seguranca.js';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Garante que apenas requisições POST sejam aceitas
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ sucesso: false, mensagem: "E-mail obrigatório." });

  // Headers administrativos (Service Key) para ignorar RLS e atualizar a tabela de usuários
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

    // Trava de segurança: Se não achar o e-mail, encerra para evitar processamento desnecessário
    if (!usuarios || usuarios.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: "E-mail não cadastrado no sistema." });
    }

    const usuario = usuarios[0];

    // 2. Trava de Segurança: 15 minutos (evita spam e bloqueio do Gmail)
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

    // 3. Busca credenciais dinâmicas do Gmail na sua tabela de configurações
    const gmailUser = await buscarConfig('email_cadastrado');
    const gmailPass = await buscarConfig('email_senha_api');

    if (!gmailUser || !gmailPass) {
      throw new Error("Configurações de e-mail ausentes na tabela configuracoes.");
    }

    // 4. Prepara a nova senha e o Hash para o banco
    const novaSenha = gerarSenhaAleatoria();
    const senhaHash = "HASH_" + Buffer.from(novaSenha).toString('base64');

    // 5. Configuração e Envio do E-mail via Nodemailer
    // Fazemos o envio PRIMEIRO para garantir que o usuário receba a senha antes de trocá-la no banco
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass }
    });

    await transporter.sendMail({
      from: `"Suporte Online-Med" <${gmailUser}>`,
      to: email.trim(),
      subject: '🔑 Recuperação de Acesso - Online-Med',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #0089a5;">Nova senha gerada</h2>
          <p>Olá, identificamos sua solicitação de recuperação de senha no sistema <strong>Online-Med</strong>.</p>
          <p>Sua nova senha de acesso temporária é:</p>
          <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #333; border-radius: 5px; border: 1px dashed #0089a5;">
            ${novaSenha}
          </div>
          <p style="margin-top: 20px; font-size: 13px; color: #666;">
            <strong>Importante:</strong> Recomendamos alterar esta senha após o seu primeiro login.<br>
            Por segurança, uma nova solicitação só poderá ser feita após 15 minutos.
          </p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 11px; color: #999;">Esta é uma mensagem automática, por favor não responda.</p>
        </div>`
    });

    // 6. Atualização do Banco: Só ocorre se o e-mail acima não der erro
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${usuario.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ 
        senha: senhaHash, 
        ultimo_reset_at: new Date().toISOString() 
      })
    });

    if (!updateRes.ok) throw new Error("Erro ao atualizar a nova senha no banco de dados.");

    return res.status(200).json({ 
      sucesso: true, 
      mensagem: "Sua nova senha foi enviada com sucesso para o e-mail informado." 
    });

  } catch (error) {
    console.error("Erro técnico na recuperação:", error.message);
    return res.status(500).json({ 
      sucesso: false, 
      mensagem: "Não foi possível processar sua recuperação agora. Tente novamente em instantes." 
    });
  }
}
