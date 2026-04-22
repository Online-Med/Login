// api/config_atendimento.js  — versão 3 (blocos independentes + todos os tipos)
// Tabelas:
//   config_tipos_consulta   — tipos de consulta
//   config_componentes      — catálogo (secao = tipo_conteudo, sem CHECK fixo)
//   config_tipo_componentes — vínculo tipo ↔ componente por tipo_conteudo
//   config_blocos_tipo      — blocos 1-6 por tipo, com config_extra jsonb
//   config_medicamentos     — catálogo de medicamentos
//   config_exames           — catálogo de exames (com subtipo LAB|IMG|OUT)

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
  const { action, id, tipo_id, secao, busca, grupo, subtipo } = query;

  try {
    // ─── GET ─────────────────────────────────────────────────────
    if (method === 'GET') {

      // Busca profissional pelo email (para carregar config na impressão)
      if (action === 'profissional_por_email' && query.email) {
        const { ok, data } = await sb(
          "user"//`usuarios?email=eq.${encodeURIComponent(query.email)}&select=id_profissional,nome,especialidade,crm&limit=1`
        );
        const prof = ok && data && data[0] ? data[0] : null;
        return res.status(200).json(prof || {});
      }


// --adicieoi um config que faltava
if (action === 'config' && query.id_profissional) {
  const { ok, data } = await sb(
    `configuracoes?id_profissional=eq.${query.id_profissional}&select=*`
  );
  // Transforma o array de configs em um objeto único { chave: valor }
  if (ok && data) {
    const obj = {};
    data.forEach(item => { obj[item.chave_config] = item.valor; });
    return res.status(200).json(obj);
  }
  return res.status(200).json({});
}


      
      if (action === 'tipos') {
        const { ok, data } = await sb('config_tipos_consulta?order=ordem.asc,nome.asc&select=*');
        return res.status(200).json(ok ? data || [] : []);
      }

      // Componentes — aceita qualquer secao (tipo_conteudo)
      if (action === 'componentes') {
        const filtroSecao = secao ? `&secao=eq.${secao}` : '';
        const { ok, data } = await sb(
          `config_componentes?order=ordem.asc,nome.asc${filtroSecao}&select=*`
        );
        return res.status(200).json(ok ? data || [] : []);
      }

      // Todos os tipos_conteudo que têm componentes (para abas dinâmicas)
      if (action === 'tipos_com_componentes') {
        const { ok, data } = await sb(
          'config_componentes?select=secao&order=secao.asc'
        );
        if (!ok) return res.status(200).json([]);
        // Deduplica
        const uniq = [...new Set((data || []).map(r => r.secao))];
        return res.status(200).json(uniq);
      }

      // Vínculos tipo ↔ componente (com dados do componente)
      if (action === 'tipo_componentes' && tipo_id) {
        const filtroSecao = secao ? `&secao=eq.${encodeURIComponent(secao)}` : '';
        const { ok, data } = await sb(
          `config_tipo_componentes?tipo_id=eq.${tipo_id}&order=ordem.asc` +
          `&select=id,tipo_id,componente_id,ativo,ordem,componente:config_componentes(id,nome,secao,icone,valor_default,unidade,ordem)`
          + (secao ? `&componente.secao=eq.${encodeURIComponent(secao)}` : '')
        );
        // Filtra pelo secao no lado JS se necessário (PostgREST join filter pode variar)
        let result = ok ? data || [] : [];
        if (secao) result = result.filter(v => v.componente && v.componente.secao === secao);
        return res.status(200).json(result);
      }

      // Blocos por tipo
      if (action === 'blocos' && tipo_id) {
        const { ok, data } = await sb(
          `config_blocos_tipo?tipo_id=eq.${tipo_id}&order=numero_bloco.asc&select=*`
        );
        return res.status(200).json(ok ? data || [] : []);
      }

      // Medicamentos
      if (action === 'medicamentos') {
        let url = 'config_medicamentos?order=nome.asc&select=*';
        if (busca) url += `&nome=ilike.*${busca}*`;
        const { ok, data } = await sb(url);
        return res.status(200).json(ok ? data || [] : []);
      }

      // Exames (com filtro por subtipo)
      if (action === 'exames') {
        let url = 'config_exames?order=grupo.asc,nome.asc&select=*';
        if (busca)   url += `&or=(nome.ilike.*${busca}*,grupo.ilike.*${busca}*)`;
        if (grupo)   url += `&grupo=eq.${grupo}`;
        if (subtipo) url += `&subtipo=eq.${subtipo}`;
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
      const prefer = action === 'bloco'
        ? 'resolution=merge-duplicates,return=representation'
        : 'return=representation';
      const { ok, data } = await sb(table, 'POST', body, { 'Prefer': prefer });
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
