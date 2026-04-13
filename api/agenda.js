import { validarEBuscaDados, SERVICE_KEY, SUPABASE_URL } from './_seguranca.js';

export default async function handler(req, res) {
  const { method, query } = req;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  // Helper interno para chamadas de escrita (POST, PATCH, DELETE)
  async function sb(path, method = 'GET', body = null, extraHeaders = {}) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: { ...headers, ...extraHeaders },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, data: text ? JSON.parse(text) : null };
  }

  try {
    // 1. Verificação de Segurança Inicial (Obrigatória para qualquer método)
    // Se o e-mail não for válido, o validarEBuscaDados lançará um erro que cairá no catch.
    const userEmail = req.headers['x-user-email'];

    // ──────────────────────────────────────────────────────────────
    // GET - LISTAGEM E CONFIGS
    // ──────────────────────────────────────────────────────────────
    if (method === 'GET') {
      const { action, id_profissional, data, termo } = query;

      if (action === 'profissionais') {
        const d = await validarEBuscaDados(req, 'usuarios', 'id_profissional,nome&tem_agenda=eq.SIM&order=nome');
        return res.status(200).json(d);
      }

      if (action === 'config') {
        const d = await validarEBuscaDados(req, 'configuracoes', `chave_config,valor&id_profissional=eq.${id_profissional}`);
        const cfg = {};
        (d || []).forEach(r => { cfg[r.chave_config] = r.valor; });
        return res.status(200).json(cfg);
      }

      if (action === 'dia') {
        const d = await validarEBuscaDados(req, 'agenda', `*&id_profissional=eq.${id_profissional}&data_agenda=eq.${data}&order=hora_agenda,is_encaixe`);
        return res.status(200).json(d || []);
      }

      if (action === 'buscar_pacientes') {
        const t = encodeURIComponent(termo || '');
        const d = await validarEBuscaDados(req, 'pacientes', `pcod,Nome,Documento,Celular,Telefone&or=(Nome.ilike.*${t}*,Documento.ilike.*${t}*)&order=Nome&limit=10`);
        return res.status(200).json(d || []);
      }
    }

    // ──────────────────────────────────────────────────────────────
    // OPERAÇÕES DE ESCRITA (POST, PATCH, DELETE)
    // ──────────────────────────────────────────────────────────────
    
    // Antes de qualquer escrita, validamos o usuário (Double check)
    await validarEBuscaDados(req, 'usuarios', 'id_profissional');

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (body.action === 'bloquear_faixa') {
        const { id_profissional, data_agenda, hora_inicio, hora_fim, motivo, intervalo } = body;
        const parseMin = h => { const [hh, mm] = h.split(':'); return +hh * 60 + +mm; };
        const fmtH = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
        const inv = parseInt(intervalo) || 15;
        const bloqueios = [];

        for (let m = parseMin(hora_inicio); m < parseMin(hora_fim); m += inv) {
          bloqueios.push({
            id_profissional: parseInt(id_profissional),
            data_agenda,
            hora_agenda: fmtH(m),
            paciente_nome: 'BLOQUEADO',
            tipo: 'BLOQUEIO',
            status: 'BLOQUEADO',
            is_bloqueado: true,
            observacao: motivo || 'Horário bloqueado'
          });
        }

        const { ok, data: d } = await sb('agenda', 'POST', bloqueios, { 'Prefer': 'return=minimal' });
        return res.status(200).json(ok ? { sucesso: true, quantidade: bloqueios.length } : { sucesso: false, erro: d });
      }

      // Validação de Conflito para novo agendamento
      if (!body.is_encaixe && !body.is_bloqueado) {
        const { data: exist } = await sb(`agenda?id_profissional=eq.${body.id_profissional}&data_agenda=eq.${body.data_agenda}&hora_agenda=eq.${body.hora_agenda}&is_encaixe=eq.false&is_bloqueado=eq.false&select=id`);
        if (exist && exist.length > 0) return res.status(409).json({ sucesso: false, erro: 'Horário já ocupado.' });
      }

      const { ok, data: d } = await sb('agenda', 'POST', body);
      return res.status(200).json(ok ? { sucesso: true, dados: d } : { sucesso: false, erro: d });
    }

    if (method === 'PATCH') {
      const { id } = query;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { ok } = await sb(`agenda?id=eq.${id}`, 'PATCH', body);
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false });
    }

    if (method === 'DELETE') {
      const { id } = query;
      const { ok } = await sb(`agenda?id=eq.${id}`, 'DELETE');
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });

  } catch (error) {
    console.error('agenda.js error:', error);
    const status = error.message.includes("autorizado") ? 401 : 500;
    return res.status(status).json({ sucesso: false, erro: error.message });
  }
}
