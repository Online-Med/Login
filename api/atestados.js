// api/atestados.js
//
// GET  ?action=usuarios                          → lista usuarios
// GET  ?action=config&id_profissional=X          → toda config do profissional (chave→valor)
// GET  ?action=get&id=X                          → atestado por ID
// GET  ?action=lista&paciente_id=X               → histórico de atestados do paciente
// GET  ?action=buscar_paciente&termo=X           → busca por nome/pcod/cpf
// POST ?action=salvar_config                     → upsert em configuracoes (body: [{mascara,chave_config,id_profissional,valor}])
// POST ?action=gerar                             → salva atestado gerado
// PATCH?id=X                                     → atualiza atestado
// DELETE?id=X                                    → exclui atestado
//
// Tabelas necessárias:
//   configuracoes (mascara text, chave_config text, id_profissional int, valor text,
//                  PRIMARY KEY (mascara, chave_config, id_profissional))
//   atestados (id bigserial PK, id_profissional int, paciente_id text,
//              paciente_nome text, tipo_atestado text, corpo_renderizado text,
//              variaveis jsonb, cid text, data_emissao date,
//              hora_emissao time, created_at timestamptz DEFAULT now())
//   profissionais (já existente no sistema)
//   pacientes     (já existente no sistema)

import { sb, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  try { await validarSessao(req); } catch (e) {
    return res.status(401).json({ erro: e.message });
  }

  const { method, query } = req;
  const { action, id, id_profissional, paciente_id, termo } = query;

  try {
    // ─── GET ─────────────────────────────────────────────────────
    if (method === 'GET') {

      if (action === 'profissionais') {
        const { ok, data } = await sb('usuarios?order=nome.asc&select=id_profissional,nome');
        return res.status(200).json(ok ? data || [] : []);
      }

      if (action === 'config' && id_profissional) {
        const { ok, data } = await sb(
          `configuracoes?id_profissional=eq.${id_profissional}&select=mascara,chave_config,valor`
        );
        if (!ok) return res.status(200).json({});
        // Transforma array em mapa { chave_config: valor }
        const mapa = {};
        (data || []).forEach(r => { mapa[r.chave_config] = r.valor; });
        return res.status(200).json(mapa);
      }

      if (action === 'get' && id) {
        const { ok, data } = await sb(`atestados?id=eq.${id}&select=*`);
        return res.status(200).json(ok ? (data && data[0]) || null : null);
      }

      if (action === 'lista' && paciente_id) {
        const { ok, data } = await sb(
          `atestados?paciente_id=eq.${paciente_id}&order=created_at.desc&select=*`
        );
        return res.status(200).json(ok ? data || [] : []);
      }

      if (action === 'buscar_paciente' && termo) {
        const t = termo.trim();
        const tLimpo = t.replace(/\./g, '').replace(/-/g, '').replace(/\//g, '');
        // Busca por nome (case insensitive), pcod exato, cpf com/sem pontuação
        const { ok, data } = await sb(
          `pacientes?or=(Nome.ilike.*${t}*,pcod.eq.${t},Documento.ilike.*${tLimpo}*)&limit=15&select=pcod,Nome,Documento,Data_Nascimento,Celular`
        );
        return res.status(200).json(ok ? data || [] : []);
      }

      return res.status(400).json({ erro: 'Parâmetro action inválido.' });
    }

    // ─── POST ────────────────────────────────────────────────────
    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (action === 'salvar_config') {
        // body = array de { mascara, chave_config, id_profissional, valor }
        const registros = Array.isArray(body) ? body : [body];
        const { ok, data } = await sb(
          'configuracoes',
          'POST',
          registros,
          { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
        );
        return res.status(200).json(ok ? { sucesso: true } : { sucesso: false, erro: JSON.stringify(data) });
      }

      if (action === 'gerar') {
        if (!body.id_profissional) return res.status(400).json({ sucesso: false, erro: 'id_profissional obrigatório.' });
        if (!body.created_at) body.created_at = new Date().toISOString();
        const { ok, data } = await sb('atestados', 'POST', body, { 'Prefer': 'return=representation' });
        if (!ok) return res.status(200).json({ sucesso: false, erro: JSON.stringify(data) });
        const criado = Array.isArray(data) ? data[0] : data;
        return res.status(200).json({ sucesso: true, id: criado?.id, dados: criado });
      }

      return res.status(400).json({ erro: 'action inválido.' });
    }

    // ─── PATCH ───────────────────────────────────────────────────
    if (method === 'PATCH') {
      if (!id) return res.status(400).json({ erro: 'id obrigatório.' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { ok, data } = await sb(`atestados?id=eq.${id}`, 'PATCH', body, { 'Prefer': 'return=minimal' });
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false, erro: JSON.stringify(data) });
    }

    // ─── DELETE ──────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ erro: 'id obrigatório.' });
      const { ok } = await sb(`atestados?id=eq.${id}`, 'DELETE');
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });

  } catch (error) {
    console.error('atestados.js error:', error);
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
