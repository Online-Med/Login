import { SUPABASE_URL, SERVICE_KEY, gerarSenhaAleatoria, buscarConfig } from './_seguranca.js';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // 1. Bloqueia qualquer método que não seja POST
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem: 'Método não permitido' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ sucesso: false, mensagem: "E-mail obrigatório." });
  }

  const adminHeaders = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // 2. Busca o usuário no banco
    const resUser = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${email.trim()}&select=id,ultimo_reset_at`, {
      headers: adminHeaders
    });
    
    const usuarios = await resUser.json();

    // ✅ PROTEÇÃO CONTRA O ERRO 'UNDEFINED':
    // Verifica se a resposta é nula ou se a lista está vazia antes de tentar acessar o item [0]
    if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
      return res.status(200).json({ sucesso: false, mensagem: "E-mail não cadastrado no sistema." });
     
    }

    const usuario = usuarios[0];

    // 3. Trava de Segurança: 15 minutos
    // O uso de 'usuario?.ultimo_reset_at' (Optional Chaining) impede o erro se o campo estiver vazio no banco
    if (usuario?.ultimo_reset_at) {
      const ultimaVez = new Date(usuario.ultimo_reset_at);
      const agora = new Date();
      const difMinutos = (agora - ultimaVez) / (1000 * 60);

      if (difMinutos < 15) {
        const falta = Math.ceil(15 - difMinutos);
        return res.status(429).json({ 
          sucesso: false, 
          mensagem: `Aguarde ${falta} minutos para solicitar uma nova senha.` 
        });
      }
    }

    // 4. Busca as credenciais do Gmail na tabela configuracoes
    const gmailUser = await buscarConfig('email_cadastrado');
    const gmailPass = await buscarConfig('email_senha_api');

    if (!gmailUser || !gmailPass) {
      throw new Error("Configurações de e-mail ausentes no banco (tabela configuracoes).");
    }

    // 5. Gera a nova senha e Hash
    const novaSenha = gerarSenhaAleatoria();
    const senhaHash = "HASH_" + Buffer.from(novaSenha).toString('base64');

    // 6. Envio via Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass }
    });

    await transporter.sendMail({
      from: `"Suporte Online-Med" <${gmailUser}>`,
      to: email.trim(),
      subject: '🔑 Recuperação de Acesso - Online-Med',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #0089a5;">Nova senha gerada</h2>
          <p>Você solicitou a recuperação de acesso para o sistema <strong>Online-Med</strong>.</p>
          <p>Sua nova senha temporária é:</p>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 26px; font-weight: bold; color: #0089a5; border-radius: 5px; border: 1px dashed #0089a5;">
            ${novaSenha}
          </div>
          <p style="margin-top: 20px; font-size: 13px; color: #666;">
            Por segurança, você só poderá solicitar um novo reset em 15 minutos.
          </p>
        </div>`
    });

    // 7. Atualiza o banco com a nova senha e o tempo do reset
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${usuario.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ 
        senha: senhaHash, 
        ultimo_reset_at: new Date().toISOString() 
      })
    });

    if (!updateRes.ok) throw new Error("Falha ao atualizar a senha no banco.");

    return res.status(200).json({ 
      sucesso: true, 
      mensagem: "E-mail enviado com sucesso!" 
    });

  } catch (error) {
    console.error("ERRO:", error.message);
    return res.status(500).json({ 
      sucesso: false, 
      mensagem: "Erro ao processar: " + error.message 
    });
  }
}
