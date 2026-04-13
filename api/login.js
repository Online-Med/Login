export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  
  // 1. IMPORTANTE: Use a Service Role Key (aquela que começa com ey... e deve ficar escondida)
  // Recomendo usar process.env.SUPABASE_SERVICE_ROLE_KEY por segurança
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpanltbXlodGp2Z2ZucGF6and3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIwMDgxMCwiZXhwIjoyMDg5Nzc2ODEwfQ.VA6bhNcYV2y95tuUZh8W94jCy4d8bh-bDFXcLYI2LVM"; 

  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, senha } = body;

    if (!email || !senha) {
       return res.status(400).json({ sucesso: false, mensagem: "E-mail e senha são obrigatórios." });
    }

    const emailLimpo = email.trim();
    const senhaHash = "HASH_" + Buffer.from(senha).toString('base64');
    
    // 2. A URL de consulta continua a mesma
    const url = `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${emailLimpo}&select=*`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY, // Mudamos para a Service Key
        'Authorization': `Bearer ${SERVICE_KEY}` // Mudamos para a Service Key
      }
    });

    const dados = await response.json();

    // Log para você debugar (veja nos logs da Vercel)
    console.log("Tentativa de login para:", emailLimpo, "Registros encontrados:", dados.length);

    if (dados && dados.length > 0) {
      if (dados[0].senha === senhaHash) {
        // Sucesso!
        return res.status(200).json({ 
            sucesso: true, 
            usuario: dados[0].nome || emailLimpo,
            perfil: dados[0].perfil // Bom retornar o perfil também
        });
      } else {
        return res.status(401).json({ sucesso: false, mensagem: "Senha incorreta." });
      }
    } else {
      // Se dados vier vazio aqui, é porque o e-mail não existe na tabela
      return res.status(404).json({ sucesso: false, mensagem: "Usuário não cadastrado no sistema." });
    }
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: "Erro técnico: " + error.message });
  }
}
