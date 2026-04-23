import { sb, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  try { await validarSessao(req); } catch (e) {
    return res.status(401).json({ erro: e.message });
  }

  const { busca, limit = 10 } = req.query;

  try {
    // Aqui usamos o nome da sua tabela: 'cid'
    // Filtramos pelo código (A10) ou pelo nome (Gripe)
    let url = `cid?select=codigo,nome&limit=${limit}`;
    
    if (busca) {
      // O ilike faz a busca ignorando maiúsculas/minúsculas
      url += `&or=(codigo.ilike.*${busca}*,nome.ilike.*${busca}*)`;
    }

    const { ok, data } = await sb(url);
    
    return res.status(200).json(ok && data ? data : []);

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
