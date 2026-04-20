// api/config_atendimento.js
// Tabelas:
//   config_tipos_consulta   — tipos de consulta
//   config_componentes      — catálogo de componentes (sinais vitais etc.)
//   config_tipo_componentes — vínculo tipo ↔ componente
//   config_blocos_tipo      — blocos 1-6 por tipo de consulta
//   config_medicamentos     — catálogo de medicamentos
//   config_exames           — catálogo de exames

import { sb, validarSessao } from './_seguranca.js';

const TABLE = {
  tipo:        'config_tipos_consulta',
  componente:  'config_componentes',
  vincular:    'config_tipo_componentes',
  bloco:       'config_blocos_tipo',
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

      if (action === 'blocos' && tipo_id) {
        const { ok, data } = await sb(
          `config_blocos_tipo?tipo_id=eq.${tipo_id}&order=numero_bloco.asc&select=*`
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

    if (method === 'POST') {
      const table = TABLE[action];
      if (!table) return res.status(400).json({ erro: 'action inválido' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      // blocos: upsert por (tipo_id, numero_bloco)
      const prefer = action === 'bloco'
        ? 'resolution=merge-duplicates,return=representation'
        : 'return=representation';
      const { ok, data } = await sb(table, 'POST', body, { 'Prefer': prefer });
      if (!ok) return res.status(200).json({ sucesso: false, erro: JSON.stringify(data) });
      const criado = Array.isArray(data) ? data[0] : data;
      return res.status(200).json({ sucesso: true, id: criado?.id, dados: criado });
    }

    if (method === 'PATCH') {
      if (!id) return res.status(400).json({ erro: 'id obrigatório' });
      const table = TABLE[action];
      if (!table) return res.status(400).json({ erro: 'action inválido' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { ok, data } = await sb(`${table}?id=eq.${id}`, 'PATCH', body, { 'Prefer': 'return=minimal' });
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false, erro: JSON.stringify(data) });
    }

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
