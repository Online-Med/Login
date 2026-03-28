// api/agenda.js
// Vercel Serverless Function – Agenda Médica
// Endpoints:
//   GET  ?action=profissionais                          → lista profissionais com agenda
//   GET  ?action=config&id_profissional=X              → configurações do profissional
//   GET  ?action=dia&id_profissional=X&data=YYYY-MM-DD → agendamentos do dia
//   GET  ?action=buscar_pacientes&termo=X              → autocomplete de pacientes
//   POST (body JSON)                                   → cria agendamento / bloqueio
//   PATCH  ?id=X  (body JSON)                          → atualiza campos
//   DELETE ?id=X                                       → exclui registro

export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  const headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json'
  };

  // Helper: faz uma chamada ao Supabase e retorna { ok, status, data }
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
      const { action, id_profissional, data, termo } = query;

      // ── Lista de profissionais ──
      if (action === 'profissionais') {
        const { ok, data: d } = await sb('usuarios?tem_agenda=eq.SIM&select=id_profissional,nome&order=nome');
        return res.status(200).json(ok ? d : []);
      }

      // ── Configurações do profissional ──
      if (action === 'config') {
        const { ok, data: d } = await sb(
          `configuracoes?id_profissional=eq.${id_profissional}&select=chave_config,valor`
        );
        if (!ok) return res.status(200).json({});
        // Transforma array [{chave_config, valor}] em objeto {chave: valor}
        const cfg = {};
        (d || []).forEach(r => { cfg[r.chave_config] = r.valor; });
        return res.status(200).json(cfg);
      }

      // ── Agendamentos do dia ──
      if (action === 'dia') {
        const { ok, data: d } = await sb(
          `agenda?id_profissional=eq.${id_profissional}&data_agenda=eq.${data}&order=hora_agenda,is_encaixe&select=*`
        );
        return res.status(200).json(ok ? (d || []) : []);
      }

      // ── Busca de pacientes (autocomplete) ──
      if (action === 'buscar_pacientes') {
        const t = encodeURIComponent(termo || '');
        const { ok, data: d } = await sb(
          `pacientes?or=(Nome.ilike.*${t}*,Documento.ilike.*${t}*)&select=pcod,Nome,Documento,Celular,Telefone&order=Nome&limit=10`
        );
        return res.status(200).json(ok ? (d || []) : []);
      }

      return res.status(400).json({ erro: 'Parâmetro action inválido.' });
    }

    // ──────────────────────────────────────────────────────────────
    //  POST – Cria agendamento (ou range de bloqueios)
    // ──────────────────────────────────────────────────────────────
    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // Bloqueio de faixa de horários
      if (body.action === 'bloquear_faixa') {
        const { id_profissional, data_agenda, hora_inicio, hora_fim, motivo, intervalo } = body;
        const parseMin = h => { const [hh, mm] = h.split(':'); return +hh * 60 + +mm; };
        const fmtH    = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
        const inv     = parseInt(intervalo) || 15;
        const bloqueios = [];

        for (let m = parseMin(hora_inicio); m < parseMin(hora_fim); m += inv) {
          bloqueios.push({
            id_profissional: parseInt(id_profissional),
            data_agenda,
            hora_agenda:      fmtH(m),
            paciente_nome:   'BLOQUEADO',
            tipo:            'BLOQUEIO',
            modalidade:      'PRESENCIAL',
            status:          'BLOQUEADO',
            primeira_consulta: false,
            is_encaixe:      false,
            is_bloqueado:    true,
            observacao:      motivo || 'Horário bloqueado'
          });
        }

        if (!bloqueios.length) return res.status(400).json({ sucesso: false, erro: 'Nenhum slot na faixa.' });

        const { ok, data: d } = await sb('agenda', 'POST', bloqueios, { 'Prefer': 'return=minimal' });
        return res.status(200).json(ok ? { sucesso: true, quantidade: bloqueios.length } : { sucesso: false, erro: JSON.stringify(d) });
      }

      // Agendamento normal / encaixe
      // Verifica conflito (slot normal já ocupado)
      if (!body.is_encaixe && !body.is_bloqueado) {
        const { data: exist } = await sb(
          `agenda?id_profissional=eq.${body.id_profissional}&data_agenda=eq.${body.data_agenda}&hora_agenda=eq.${body.hora_agenda}&is_encaixe=eq.false&is_bloqueado=eq.false&select=id`
        );
        if (exist && exist.length > 0) {
          return res.status(409).json({ sucesso: false, erro: 'Horário já ocupado. Use Encaixe.' });
        }
      }

      const { ok, data: d } = await sb('agenda', 'POST', body, { 'Prefer': 'return=representation' });
      return res.status(200).json(ok ? { sucesso: true, dados: d } : { sucesso: false, erro: JSON.stringify(d) });
    }

    // ──────────────────────────────────────────────────────────────
    //  PATCH – Atualiza campos de um agendamento
    // ──────────────────────────────────────────────────────────────
    if (method === 'PATCH') {
      const { id } = query;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // Mover horário: verifica conflito no destino
      if (body.hora_agenda && !body.is_encaixe && !body.is_bloqueado) {
        const { data: ag } = await sb(`agenda?id=eq.${id}&select=id_profissional,data_agenda,is_encaixe,is_bloqueado`);
        if (ag && ag[0] && !ag[0].is_encaixe && !ag[0].is_bloqueado) {
          const { data: conf } = await sb(
            `agenda?id_profissional=eq.${ag[0].id_profissional}&data_agenda=eq.${ag[0].data_agenda}&hora_agenda=eq.${body.hora_agenda}&is_encaixe=eq.false&is_bloqueado=eq.false&id=neq.${id}&select=id`
          );
          if (conf && conf.length > 0) {
            return res.status(409).json({ sucesso: false, erro: `Horário ${body.hora_agenda} já está ocupado.` });
          }
        }
      }

      const { ok, data: d } = await sb(`agenda?id=eq.${id}`, 'PATCH', body, { 'Prefer': 'return=minimal' });
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false, erro: JSON.stringify(d) });
    }

    // ──────────────────────────────────────────────────────────────
    //  DELETE – Remove agendamento
    // ──────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      const { id } = query;
      const { ok } = await sb(`agenda?id=eq.${id}`, 'DELETE');
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });

  } catch (error) {
    console.error('agenda.js error:', error);
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
