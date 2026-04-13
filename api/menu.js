// api/menu.js
import { SUPABASE_URL, sbHeaders, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  try { await validarSessao(req); } catch (e) { return res.status(401).json({ erro: e.message }); }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/menu?select=*`, {
      headers: { ...sbHeaders, 'Prefer': 'count=exact' }
    });
    const rawData = await r.json();

    if (!rawData.length) {
      return res.status(200).json([]);
    }

    const menuTratado = rawData.map(item => ({
      ordem:    item.ordem    || item.Ordem    || item.ORDEM,
      descricao: item.descricao || item.Descricao || item.Descrição,
      pagina:   item.pagina   || item.Pagina,
      icone:    item.icone    || 'bi-folder2'
    }));

    menuTratado.sort((a, b) => String(a.ordem).localeCompare(String(b.ordem), undefined, { numeric: true }));
    return res.status(200).json(menuTratado);

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
