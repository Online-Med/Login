// api/convenios.js
import { SUPABASE_URL, sbHeaders, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  try { await validarSessao(req); } catch (e) { return res.status(401).json({ erro: e.message }); }

  const { method, query } = req;

  try {
    if (method === 'GET') {
      const { id, nome } = query;
      const url = new URL(`${SUPABASE_URL}/rest/v1/convenios`);
      
      if (id) {
        url.searchParams.set('id', `eq.${id}`);
        url.searchParams.set('select', '*');
        const r = await fetch(url.toString(), { headers: sbHeaders });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, convenio: d[0] });
      }

      url.searchParams.set('select', '*');
      url.searchParams.set('order', 'CONVENIO.asc');
      if (nome) url.searchParams.set('CONVENIO', `ilike.*${nome}*`);

      const r = await fetch(url.toString(), { headers: sbHeaders });
      const d = await r.json();
      return res.status(200).json({ sucesso: true, dados: d });
    }

    if (method === 'POST') {
      // Ajuste: Certifique-se que o campo no Supabase aceita "NOVO CONVÊNIO"
      const r = await fetch(`${SUPABASE_URL}/rest/v1/convenios`, { 
        method: 'POST', 
        headers: { ...sbHeaders, 'Prefer': 'return=representation' }, 
        body: JSON.stringify({ CONVENIO: "NOVO CONVÊNIO" }) 
      });
      
      const d = await r.json();
      
      // LOG de depuração: se d[0].id for undefined, mude para o nome correto da coluna
      if (d && d.length > 0) {
        return res.status(200).json({ sucesso: true, id: d[0].id }); 
      }
      return res.status(400).json({ sucesso: false, erro: "Não foi possível gerar ID. Verifique a tabela." });
    }

    // PATCH e DELETE seguem a mesma lógica de URL segura...
    if (method === 'PATCH' || method === 'DELETE') {
        const { id } = query;
        const url = `${SUPABASE_URL}/rest/v1/convenios?id=eq.${id}`;
        const options = { 
            method: method, 
            headers: method === 'PATCH' ? { ...sbHeaders, 'Prefer': 'return=representation' } : sbHeaders 
        };
        if (method === 'PATCH') options.body = JSON.stringify(req.body);
        
        const r = await fetch(url, options);
        return res.status(200).json({ sucesso: r.ok });
    }

  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
