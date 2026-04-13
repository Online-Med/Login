// api/usuarios.js
import { SUPABASE_URL, sbHeaders, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  try { await validarSessao(req); } catch (e) { return res.status(401).json({ erro: e.message }); }

  const { method, query } = req;

  try {
    if (method === 'GET') {
      const { id, nome, perfil } = query;
      if (id) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=*&id_profissional=eq.${id}`, { headers: sbHeaders });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, usuario: d[0] });
      }
      let url = `${SUPABASE_URL}/rest/v1/usuarios?select=*&order=nome.asc`;
      if (nome)   url += `&nome=ilike.*${nome}*`;
      if (perfil) url += `&perfil=eq.${perfil}`;
      const r = await fetch(url, { headers: sbHeaders });
      const d = await r.json();
      return res.status(200).json({ sucesso: true, dados: d });
    }

    if (method === 'POST') {
      const rMax  = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=id_profissional&order=id_profissional.desc&limit=1`, { headers: sbHeaders });
      const ultimo = await rMax.json();
      const novoId = (ultimo.length > 0) ? (parseInt(ultimo[0].id_profissional) + 1) : 1;
      const reserva = { id_profissional: novoId, nome: "NOVO USUÁRIO - AGUARDANDO DADOS", email: `temp_${novoId}@med.com`, perfil: "RECEPCAO", tem_agenda: "NÃO" };
      await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, { method: 'POST', headers: { ...sbHeaders, 'Prefer': 'return=representation' }, body: JSON.stringify(reserva) });
      return res.status(200).json({ sucesso: true, id_profissional: novoId });
    }

    if (method === 'PATCH') {
      const { id } = query;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id_profissional=eq.${id}`, { method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
      return r.ok ? res.status(200).json({ sucesso: true }) : res.status(400).json({ sucesso: false, erro: "Erro ao atualizar usuário." });
    }

    if (method === 'DELETE') {
      const { id } = query;
      await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id_profissional=eq.${id}`, { method: 'DELETE', headers: sbHeaders });
      return res.status(200).json({ sucesso: true });
    }

  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
