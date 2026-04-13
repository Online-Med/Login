import { SUPABASE_URL, SERVICE_KEY } from './seguranca.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, senha } = body;

    if (!email || !senha) {
      return res.status(400).json({ sucesso: false, mensagem: "E-mail e senha são obrigatórios." });
    }

    const emailLimpo = email.trim();
    
    // Mantendo sua lógica de HASH solicitada anteriormente
    const senhaHash = "HASH_" + Buffer.from(senha).toString('base64');
    
    // Consulta usando a URL e a SERVICE_KEY centralizadas
    const url = `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${emailLimpo}&select=*`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });

    const dados = await response.json();

    if (dados && dados.length > 0) {
      if (dados[0].senha === senhaHash) {
        // Limpamos a senha antes de devolver os dados para o frontend por segurança
        const { senha, ...usuarioSemSenha } = dados[0];
        
        return res.status(200).json({ 
          sucesso: true, 
          usuario: usuarioSemSenha.nome || emailLimpo,
          perfil: usuarioSemSenha.perfil,
          dados: usuarioSemSenha 
        });
      } else {
        return res.status(401).json({ sucesso: false, mensagem: "Senha incorreta." });
      }
    } else {
      return res.status(404).json({ sucesso: false, mensagem: "Usuário não cadastrado no sistema." });
    }
  } catch (error) {
    console.error("Erro no login:", error.message);
    return res.status(500).json({ sucesso: false, mensagem: "Erro técnico: " + error.message });
  }
}
