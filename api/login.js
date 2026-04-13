// api/login.js
// Não usa validarSessao — este endpoint É a autenticação.
import { SUPABASE_URL, SERVICE_KEY } from './_seguranca.js';

export default async function handler(req, res) {
  // Garante que erros de import apareçam como JSON, não como HTML do Vercel
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, senha } = body || {};

    if (!email || !senha) {
      return res.status(400).json({ sucesso: false, mensagem: "E-mail e senha são obrigatórios." });
    }

    const emailLimpo = email.trim().toLowerCase();
    const senhaHash  = "HASH_" + Buffer.from(senha).toString('base64');

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(emailLimpo)}&select=nome,senha,perfil`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );

    if (!r.ok) {
      const detalhe = await r.text();
      console.error('Supabase error no login:', r.status, detalhe);
      return res.status(500).json({ sucesso: false, mensagem: "Erro ao consultar usuários." });
    }

    const dados = await r.json();

    if (!dados || dados.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: "Usuário não cadastrado no sistema." });
    }

    if (dados[0].senha !== senhaHash) {
      return res.status(401).json({ sucesso: false, mensagem: "Senha incorreta." });
    }

    // Salva e-mail na resposta para o dashboard armazenar no localStorage
    return res.status(200).json({
      sucesso:  true,
      usuario:  dados[0].nome || emailLimpo,
      email:    emailLimpo,
      perfil:   dados[0].perfil
    });

  } catch (error) {
    console.error('login.js error:', error);
    return res.status(500).json({ sucesso: false, mensagem: "Erro técnico: " + error.message });
  }
}
