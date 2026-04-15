// api/convenios.js
import { SUPABASE_URL, sbHeaders, validarSessao } from './_seguranca.js';

export default async function handler(req, r) {
  try { await validarSessao(req); } catch (e) { return res.status(401).json({ erro: e.message }); }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios?select=CONVENIO&order=CONVENIO.asc`, { headers: sbHeaders });
    const dados = await r.json();
    return res.status(200).json(dados);
  } catch (error) {
    return res.status(500).json([]);
  }
}
