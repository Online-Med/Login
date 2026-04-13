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

  // Headers administrativos para ignorar RLS e atualizar dados sensíveis
  const adminHeaders = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // 2. Busca o usuário no banco para validar se existe e checar a trava de tempo
    const resUser = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${email.trim()}&select=id,ultimo_reset_at`, {
      headers: adminHeaders
    });
    
    const usuarios = await resUser.json();

    // Validação rigorosa: se não encontrar na lista, o e-mail não existe no sistema
    if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
      return res.status(404).json({ 
        sucesso: false, 
        mensagem: "E-mail não cadastrado no sistema." 
      });
    }

    const usuario = usuarios[0];

    // 3. Trava de Segurança: 15 minutos (evita spam e bloqueio da conta Gmail)
    // O uso de usuario?. garante que não dê erro se o campo vier nulo
    if (usuario?.ultimo_reset_at) {
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

    // 4. Busca as credenciais de envio na tabela de configurações
    const gmailUser = await buscarConfig('email_cadastrado');
    const gmailPass = await buscarConfig('email_senha_api');

    if (!gmailUser || !gmailPass) {
      throw new Error("Configurações de e-mail (Gmail) não encontradas no banco.");
    }

    // 5. Gera a nova senha e prepara o Hash
    const novaSenha = gerarSenhaAleatoria();
    const senhaHash = "HASH_" + Buffer.from(novaSenha).toString('base64');

    // 6. Configura o transporte do Gmail via Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { 
        user: gmailUser, 
        pass: gmailPass // Aqui deve estar a senha de app de 16 dígitos
      }
    });

    // 7. Tenta enviar o e-mail primeiro
    await transporter.sendMail({
      from: `"Suporte Online-Med" <${gmailUser}>`,
      to: email.trim(),
      subject: '🔑 Recuperação de Acesso - Online-Med',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #0089a5;">Sua nova senha chegou!</h2>
          <p>Você solicitou a recuperação de senha para o sistema <strong>Online-Med</strong>.</p>
          <p>Sua nova senha temporária é:</p>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 26px; font-weight: bold; color: #0089a5; border-radius: 5px; border: 1px dashed #0089a5;">
            ${novaSenha}
          </div>
          <p style="margin-top: 20px; font-size: 13px; color: #666;">
            <strong>Segurança:</strong> Por proteção à sua conta, você só poderá pedir um novo reset daqui a 15 minutos.
          </p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 11px; color: #999; text-align: center;">Online-Med Saúde Consultórios</p>
        </div>`
    });

    // 8. Se o e-mail foi enviado sem erros, atualiza o banco com a nova senha e o timestamp
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${usuario.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ 
        senha: senhaHash, 
        ultimo_reset_at: new Date().toISOString() 
      })
    });

    if (!updateRes.ok) throw new Error("Falha ao salvar a nova senha no banco.");

    return res.status(200).json({ 
      sucesso: true, 
      mensagem: "E-mail de recuperação enviado com sucesso!" 
    });

  } catch (error) {
    console.error("ERRO RECUPERAR:", error.message);
    return res.status(500).json({ 
      sucesso: false, 
      mensagem: "Erro técnico: " + error.message 
    });
  }
}
