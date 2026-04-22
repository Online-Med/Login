// api/atendimento.js
// GET  ?action=get&agenda_id=X   → busca por agenda
// GET  ?action=get&id=X          → busca por id
// GET  ?action=historico&paciente_id=X
// POST  body JSON                → cria
// PATCH ?id=X  body JSON         → atualiza
// DELETE ?id=X                   → exclui

import { sb, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  try { await validarSessao(req); } catch (e) {
    return res.status(401).json({ erro: e.message });
  }

  const { method, query } = req;

  try {
    if (method === 'GET') {
      const { action, agenda_id, id, paciente_id } = query;

      if (action === 'get' && agenda_id) {
        const { ok, data } = await sb(
          `atendimentos?agenda_id=eq.${agenda_id}&order=created_at.desc&limit=1&select=*`
        );
        return res.status(200).json(ok ? (data && data[0]) || null : null);
      }

      if (action === 'get' && id) {
        const { ok, data } = await sb(`atendimentos?id=eq.${id}&select=*`);
        return res.status(200).json(ok ? (data && data[0]) || null : null);
      }

      if (action === 'historico' && paciente_id) {
        const { ok, data } = await sb(
          `atendimentos?paciente_id=eq.${paciente_id}&status=eq.ENCERRADO` +
          `&order=data_atendimento.desc,hora_inicio.desc&select=*`
        );
        return res.status(200).json(ok ? data || [] : []);
      }

      return res.status(400).json({ erro: 'Parâmetro action inválido.' });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body.agenda_id) return res.status(400).json({ sucesso: false, erro: 'agenda_id obrigatório.' });
      if (!body.created_at) body.created_at = new Date().toISOString();
      if (!body.hora_inicio) body.hora_inicio = new Date().toISOString();
      const { ok, data } = await sb('atendimentos', 'POST', body, { 'Prefer': 'return=representation' });
      if (!ok) return res.status(200).json({ sucesso: false, erro: JSON.stringify(data) });
      const criado = Array.isArray(data) ? data[0] : data;
      return res.status(200).json({ sucesso: true, id: criado?.id, dados: criado });
    }

    if (method === 'PATCH') {
      const { id } = query;
      if (!id) return res.status(400).json({ sucesso: false, erro: 'id obrigatório.' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body.status === 'ENCERRADO' && !body.hora_fim) body.hora_fim = new Date().toISOString();
      const { ok, data } = await sb(
        `atendimentos?id=eq.${id}`, 'PATCH', body, { 'Prefer': 'return=minimal' }
      );
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false, erro: JSON.stringify(data) });
    }

    if (method === 'DELETE') {
      const { id } = query;
      if (!id) return res.status(400).json({ sucesso: false, erro: 'id obrigatório.' });
      const { ok } = await sb(`atendimentos?id=eq.${id}`, 'DELETE');
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (error) {
    console.error('atendimento.js error:', error);
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
