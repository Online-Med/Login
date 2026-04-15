import { SUPABASE_URL, SERVICE_KEY, gerarSenhaAleatoria, buscarConfig } from './_seguranca.js';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Define o header de resposta logo no início
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem: 'Método não permitido' });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ sucesso: false, mensagem: "E-mail obrigatório." });
  }

  const adminHeaders = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Busca o usuário no banco usando a nova URL API para evitar o aviso de 'deprecation'
    const consultaUrl = new URL(`${SUPABASE_URL}/rest/v1/usuarios`);
    consultaUrl.searchParams.set('email', `eq.${email.trim().toLowerCase()}`);
    consultaUrl.searchParams.set('select', 'id_profissional,ultimo_reset_at');

    const resUser = await fetch(consultaUrl.toString(), { headers: adminHeaders });

    if (!resUser.ok) {
      throw new Error("Erro ao consultar usuários: HTTP " + resUser.status);
    }

    const usuarios = await resUser.json();

    if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
      // Retornamos 200 com sucesso:false para evitar erros 404 de console que te confundiram
      return res.status(200).json({ sucesso: false, mensagem: "E-mail não cadastrado no sistema." });
    }

    const usuario = usuarios[0];

    // 2. Trava de segurança: só 1 reset a cada 15 minutos
    if (usuario?.ultimo_reset_at) {
      const ultimaVez = new Date(usuario.ultimo_reset_at);
      const agora = new Date();
      const difMinutos = (agora - ultimaVez) / (1000 * 60);

      if (difMinutos < 15) {
        const falta = Math.ceil(15 - difMinutos);
        return res.status(429).json({
          sucesso: false,
          mensagem: `Aguarde ${falta} minuto(s) para solicitar uma nova senha.`
        });
      }
    }

    // 3. Busca credenciais de e-mail (Gmail)
    const gmailUser = await buscarConfig('email_cadastrado');
    const gmailPass = await buscarConfig('email_senha_api');

    if (!gmailUser || !gmailPass) {
      throw new Error("Configurações de e-mail ausentes no banco (tabela configuracoes).");
    }

    // 4. Gera nova senha e seu hash
    const novaSenha = gerarSenhaAleatoria();
    const senhaHash = "HASH_" + Buffer.from(novaSenha).toString('base64');

    // 5. Envia o e-mail via Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass }
    });

    await transporter.sendMail({
      from: `"Suporte Online-Med" <${gmailUser}>`,
      to: email.trim(),
      subject: '🔑 Recuperação de Acesso - Online-Med',
      html: `
        <div style="font-family:sans-serif;max-width:500px;padding:20px;border:1px solid #eee;border-radius:10px;">
          <h2 style="color:#0089a5;">Nova senha gerada</h2>
          <p>Você solicitou a recuperação de acesso para o sistema <strong>Online-Med</strong>.</p>
          <p>Sua nova senha temporária é:</p>
          <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:26px;
                      font-weight:bold;color:#0089a5;border-radius:5px;border:1px dashed #0089a5;">
            ${novaSenha}
          </div>
          <p style="margin-top:20px;font-size:13px;color:#666;">
            Por segurança, você só poderá solicitar um novo reset em 15 minutos.
          </p>
        </div>`
    });

    // 6. Atualiza a senha e o timestamp no banco
    const updateUrl = new URL(`${SUPABASE_URL}/rest/v1/usuarios`);
    updateUrl.searchParams.set('id_profissional', `eq.${usuario.id_profissional}`);

    const updateRes = await fetch(updateUrl.toString(), {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ 
        senha: senhaHash, 
        ultimo_reset_at: new Date().toISOString() 
      })
    });

    if (!updateRes.ok) throw new Error("Falha ao atualizar a senha no banco.");

    return res.status(200).json({ sucesso: true, mensagem: "E-mail enviado com sucesso!" });

  } catch (error) {
    console.error("recuperar.js ERRO:", error.message);
    return res.status(500).json({ sucesso: false, mensagem: "Erro técnico: " + error.message });
  }
}
