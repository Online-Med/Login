// api/atendimento.js
// Vercel Serverless Function – Atendimento Médico
// Endpoints:
//   GET  ?action=get&agenda_id=X   → busca atendimento pelo id da agenda
//   GET  ?action=get&id=X          → busca atendimento pelo id próprio
//   POST (body JSON)               → cria novo atendimento
//   PATCH  ?id=X  (body JSON)      → atualiza campos
//   DELETE ?id=X                   → exclui registro

export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  const headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json'
  };

  async function sb(path, method = 'GET', body = null, extraHeaders = {}) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: { ...headers, ...extraHeaders },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    return { ok: r.ok, status: r.status, data };
  }

  const { method, query } = req;

  try {

    // ──────────────────────────────────────────────────────────────
    //  GET
    // ──────────────────────────────────────────────────────────────
    if (method === 'GET') {
      const { action, agenda_id, id } = query;

      // Busca por agenda_id (retorna o atendimento vinculado àquele slot)
      if (action === 'get' && agenda_id) {
        const { ok, data } = await sb(
          `atendimentos?agenda_id=eq.${agenda_id}&order=created_at.desc&limit=1&select=*`
        );
        if (!ok) return res.status(200).json(null);
        return res.status(200).json((data && data[0]) || null);
      }

      // Busca por id do próprio atendimento
      if (action === 'get' && id) {
        const { ok, data } = await sb(`atendimentos?id=eq.${id}&select=*`);
        if (!ok) return res.status(200).json(null);
        return res.status(200).json((data && data[0]) || null);
      }

      return res.status(400).json({ erro: 'Parâmetro action inválido.' });
    }

    // ──────────────────────────────────────────────────────────────
    //  POST – Cria novo atendimento
    // ──────────────────────────────────────────────────────────────
    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // Garante campos obrigatórios
      if (!body.agenda_id) {
        return res.status(400).json({ sucesso: false, erro: 'agenda_id obrigatório.' });
      }

      // Adiciona timestamps se não vieram
      if (!body.created_at) body.created_at = new Date().toISOString();
      if (!body.hora_inicio) body.hora_inicio = new Date().toISOString();

      const { ok, data } = await sb(
        'atendimentos',
        'POST',
        body,
        { 'Prefer': 'return=representation' }
      );

      if (!ok) return res.status(200).json({ sucesso: false, erro: JSON.stringify(data) });
      const criado = Array.isArray(data) ? data[0] : data;
      return res.status(200).json({ sucesso: true, id: criado?.id, dados: criado });
    }

    // ──────────────────────────────────────────────────────────────
    //  PATCH – Atualiza atendimento
    // ──────────────────────────────────────────────────────────────
    if (method === 'PATCH') {
      const { id } = query;
      if (!id) return res.status(400).json({ sucesso: false, erro: 'id obrigatório.' });

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // Se estiver encerrando, grava hora_fim
      if (body.status === 'ENCERRADO' && !body.hora_fim) {
        body.hora_fim = new Date().toISOString();
      }

      const { ok, data } = await sb(
        `atendimentos?id=eq.${id}`,
        'PATCH',
        body,
        { 'Prefer': 'return=minimal' }
      );

      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false, erro: JSON.stringify(data) });
    }

    // ──────────────────────────────────────────────────────────────
    //  DELETE – Remove atendimento
    // ──────────────────────────────────────────────────────────────
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
