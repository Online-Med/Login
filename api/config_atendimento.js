// api/config_atendimento.js
// Tabelas usadas:
//   config_tipos_consulta   — tipos de consulta (Consulta Padrão, Retorno…)
//   config_componentes      — catálogo de campos (Pressão Arterial, Freq. Cardíaca…)
//   config_tipo_componentes — vínculo tipo ↔ componente (com ativo, ordem)
//   config_medicamentos     — catálogo de medicamentos (nome, dose, posologia, favoritos)
//   config_exames           — catálogo de exames (nome, grupo, favoritos)
//
// GET  ?action=tipos
// GET  ?action=componentes[&secao=SINAIS_VITAIS|HDA]
// GET  ?action=tipo_componentes&tipo_id=X
// GET  ?action=medicamentos[&busca=termo]
// GET  ?action=exames[&busca=termo&grupo=G]
// POST ?action=tipo|componente|vincular|medicamento|exame   (body JSON)
// PATCH?action=tipo|componente|vincular|medicamento|exame &id=X
// DELETE?action=tipo|componente|vincular|medicamento|exame &id=X

import { sb, validarSessao } from './_seguranca.js';

const TABLE = {
  tipo:        'config_tipos_consulta',
  componente:  'config_componentes',
  vincular:    'config_tipo_componentes',
  medicamento: 'config_medicamentos',
  exame:       'config_exames',
};

export default async function handler(req, res) {
  try { await validarSessao(req); } catch (e) {
    return res.status(401).json({ erro: e.message });
  }

  const { method, query } = req;
  const { action, id, tipo_id, secao, busca, grupo } = query;

  try {
    // ─── GET ─────────────────────────────────────────────────────
    if (method === 'GET') {
      if (action === 'tipos') {
        const { ok, data } = await sb('config_tipos_consulta?order=ordem.asc,nome.asc&select=*');
        return res.status(200).json(ok ? data || [] : []);
      }

      if (action === 'componentes') {
        const filtroSecao = secao ? `&secao=eq.${secao}` : '';
        const { ok, data } = await sb(`config_componentes?order=ordem.asc,nome.asc${filtroSecao}&select=*`);
        return res.status(200).json(ok ? data || [] : []);
      }

      if (action === 'tipo_componentes' && tipo_id) {
        const { ok, data } = await sb(
          `config_tipo_componentes?tipo_id=eq.${tipo_id}&order=ordem.asc` +
          `&select=id,tipo_id,componente_id,ativo,ordem,componente:config_componentes(id,nome,secao,icone,valor_default,unidade,ordem)`
        );
        return res.status(200).json(ok ? data || [] : []);
      }

      if (action === 'medicamentos') {
        let url = 'config_medicamentos?order=nome.asc&select=*';
        if (busca) url += `&nome=ilike.*${busca}*`;
        const { ok, data } = await sb(url);
        return res.status(200).json(ok ? data || [] : []);
      }

      if (action === 'exames') {
        let url = 'config_exames?order=grupo.asc,nome.asc&select=*';
        if (busca) url += `&or=(nome.ilike.*${busca}*,grupo.ilike.*${busca}*)`;
        if (grupo)  url += `&grupo=eq.${grupo}`;
        const { ok, data } = await sb(url);
        return res.status(200).json(ok ? data || [] : []);
      }

      return res.status(400).json({ erro: 'action inválido' });
    }

    // ─── POST ─────────────────────────────────────────────────────
    if (method === 'POST') {
      const table = TABLE[action];
      if (!table) return res.status(400).json({ erro: 'action inválido' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { ok, data } = await sb(table, 'POST', body, { 'Prefer': 'return=representation' });
      if (!ok) return res.status(200).json({ sucesso: false, erro: JSON.stringify(data) });
      const criado = Array.isArray(data) ? data[0] : data;
      return res.status(200).json({ sucesso: true, id: criado?.id, dados: criado });
    }

    // ─── PATCH ────────────────────────────────────────────────────
    if (method === 'PATCH') {
      if (!id) return res.status(400).json({ erro: 'id obrigatório' });
      const table = TABLE[action];
      if (!table) return res.status(400).json({ erro: 'action inválido' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { ok, data } = await sb(`${table}?id=eq.${id}`, 'PATCH', body, { 'Prefer': 'return=minimal' });
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false, erro: JSON.stringify(data) });
    }

    // ─── DELETE ───────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ erro: 'id obrigatório' });
      const table = TABLE[action];
      if (!table) return res.status(400).json({ erro: 'action inválido' });
      const { ok } = await sb(`${table}?id=eq.${id}`, 'DELETE');
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false });
    }

    return res.status(405).json({ erro: 'Método não permitido' });

  } catch (error) {
    console.error('config_atendimento.js error:', error);
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}  
