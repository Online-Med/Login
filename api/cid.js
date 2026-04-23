import { sb, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  try { 
    await validarSessao(req); 
  } catch (e) {
    return res.status(401).json({ erro: e.message });
  }

  const { busca, limit = 10 } = req.query;

  try {
    // Verifique se o nome da tabela no Supabase é 'cid' mesmo
    let url = `cid?select=codigo,nome&limit=${limit}`;
    
    if (busca) {
      url += `&or=(codigo.ilike.*${encodeURIComponent(busca)}*,nome.ilike.*${encodeURIComponent(busca)}*)`;
    }

    const { ok, data } = await sb(url);
    return res.status(200).json(ok && data ? data : []);

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
