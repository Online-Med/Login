// api/configuracoes.js
import { sb, validarSessao } from './_seguranca.js';

// Valores padrão usados quando um profissional ainda não tem config
const DEFAULTS = {
  horario_inicio_agenda: '08:00',
  horario_fim_agenda:    '18:00',
  dias_agenda:           'SEG:TER:QUA:QUI:SEX',
  tempo_agenda:          '30'
};

export default async function handler(req, res) {
  try { await validarSessao(req); } catch (e) { return res.status(401).json({ sucesso:false, erro: e.message }); }

  const { method, query } = req;
  const action = (query && query.action) ? String(query.action).toLowerCase() : '';

  try {
    // -----------------------
    // Hospitais (CRUD)
    // /api/configuracoes?action=hospitais
    // -----------------------
    if (action === 'hospitais') {
      // GET -> lista ou 1 registro
      if (method === 'GET') {
        const { id } = query;
        const path = id ? `hospitais?id=eq.${encodeURIComponent(id)}&select=*` : 'hospitais?select=*';
        const { ok, status, data } = await sb(path);
        if (!ok) return res.status(status || 500).json({ sucesso: false, erro: 'Erro ao consultar hospitais' });
        return res.status(200).json({ sucesso: true, dados: data || [] });
      }

      // POST -> cria novo hospital
      if (method === 'POST') {
        const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
        if (!body || !body.nome) return res.status(400).json({ sucesso:false, erro: 'Campo nome obrigatório' });

        const { ok, status, data, error } = await sb(
          'hospitais',
          'POST',
          body,
          { 'Prefer': 'return=representation' }
        );

        if (!ok) {
          return res.status(status || 500).json({ sucesso:false, erro: error || 'Erro ao criar hospital' });
        }

        const newId = Array.isArray(data) && data[0] ? data[0].id : null;
        return res.status(200).json({ sucesso: true, id: newId, dados: data });
      }

      // PATCH -> atualiza hospital
      if (method === 'PATCH') {
        const { id } = query;
        if (!id) return res.status(400).json({ sucesso:false, erro: 'id obrigatório' });
        const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
        const { ok, status, error } = await sb(`hospitais?id=eq.${encodeURIComponent(id)}`, 'PATCH', body, { 'Prefer': 'return=minimal' });
        if (!ok) return res.status(status || 500).json({ sucesso:false, erro: error || 'Erro ao atualizar' });
        return res.status(200).json({ sucesso: true });
      }

      // DELETE -> exclui hospital
      if (method === 'DELETE') {
        const { id } = query;
        if (!id) return res.status(400).json({ sucesso:false, erro: 'id obrigatório' });
        const { ok, status, error } = await sb(`hospitais?id=eq.${encodeURIComponent(id)}`, 'DELETE');
        if (!ok) return res.status(status || 500).json({ sucesso:false, erro: error || 'Erro ao excluir' });
        return res.status(200).json({ sucesso: true });
      }

      return res.status(405).json({ sucesso:false, erro: 'Método não permitido para hospitais.' });
    }

    // -----------------------
    // Anexos (metadados) - grava metadados de anexos
    // /api/configuracoes?action=attachments&hospital_id=ID  (POST com JSON { anexos: [...] })
    // -----------------------
    if (action === 'attachments') {
      if (method === 'POST') {
        const hospital_id = query.hospital_id;
        if (!hospital_id) return res.status(400).json({ sucesso:false, erro: 'hospital_id obrigatório' });

        // espera body JSON: { anexos: [{ nome, url, content_type, size }, ...] }
        const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
        const anexos = (body && Array.isArray(body.anexos)) ? body.anexos : null;
        if (!anexos || anexos.length === 0) return res.status(400).json({ sucesso:false, erro: 'Nenhum anexo informado' });

        // grava cada anexo na tabela hospitais_attachments
        const payload = anexos.map(a => ({
          hospital_id: parseInt(hospital_id),
          nome: a.nome || (a.filename || ''),
          url: a.url || '',
          content_type: a.content_type || '',
          size: a.size || 0
        }));

        const { ok, status, data, error } = await sb('hospitais_attachments', 'POST', payload, { 'Prefer': 'return=representation' });
        if (!ok) return res.status(status || 500).json({ sucesso:false, erro: error || 'Erro ao gravar anexos' });
        return res.status(200).json({ sucesso: true, anexos: data || [] });
      }

      // DELETE -> /api/configuracoes?action=attachments&id=ATTACH_ID
      if (method === 'DELETE') {
        const { id } = query;
        if (!id) return res.status(400).json({ sucesso:false, erro: 'id obrigatório' });
        const { ok, status, error } = await sb(`hospitais_attachments?id=eq.${encodeURIComponent(id)}`, 'DELETE');
        if (!ok) return res.status(status || 500).json({ sucesso:false, erro: error || 'Erro ao deletar anexo' });
        return res.status(200).json({ sucesso: true });
      }

      return res.status(405).json({ sucesso:false, erro: 'Método não permitido para attachments.' });
    }

    // -----------------------
    // Funções originais de configuracoes (GET/PUT)
    // -----------------------
    // ── GET ──────────────────────────────────────────────────────
    if (method === 'GET') {
      const { id_profissional, action: act, termo } = query;

      // 1. Prioridade Total: Busca de CID
      if (act === 'buscar_cid') {
        if (!termo) return res.status(200).json([]);
        const t = encodeURIComponent(String(termo||'').trim());
        const { ok, data } = await sb(
          `cid?or=(codigo.ilike.*${t}*,descricao.ilike.*${t}*)&limit=10&select=codigo,descricao`
        );
        return res.status(200).json(ok ? data || [] : []);
      }

      // 2. Lógica Original de Configurações (só roda se não for buscar_cid)
      if (!id_profissional) {
        return res.status(400).json({ erro: 'id_profissional obrigatório.' });
      }

      const { ok, data } = await sb(
        `configuracoes?id_profissional=eq.${id_profissional}&select=chave_config,valor`
      );

      const cfg = { ...DEFAULTS };
      if (ok && data) {
        data.forEach(r => { cfg[r.chave_config] = r.valor; });
      }
      return res.status(200).json({ sucesso: true, config: cfg });
    }

    // ── PUT ?id_profissional=X body: { chave: valor, ... } ──────────────
    if (method === 'PUT') {
      const { id_profissional } = query;
      if (!id_profissional) return res.status(400).json({ erro: 'id_profissional obrigatório.' });

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const chaves = Object.keys(DEFAULTS); // só salva chaves conhecidas

      const erros = [];
      for (const chave of chaves) {
        if (!(chave in body)) continue; // não enviou essa chave, ignora

        const valor = String(body[chave] || '').trim();

        // Verifica se já existe
        const { data: exist } = await sb(
          `configuracoes?id_profissional=eq.${id_profissional}&chave_config=eq.${chave}&select=chave_config`
        );

        if (exist && exist.length > 0) {
          // UPDATE
          const { ok } = await sb(
            `configuracoes?id_profissional=eq.${id_profissional}&chave_config=eq.${chave}`,
            'PATCH', { valor }, { 'Prefer': 'return=minimal' }
          );
          if (!ok) erros.push(chave);
        } else {
          // INSERT
          const { ok } = await sb(
            'configuracoes', 'POST',
            { id_profissional: parseInt(id_profissional), chave_config: chave, valor },
            { 'Prefer': 'return=minimal' }
          );
          if (!ok) erros.push(chave);
        }
      }

      if (erros.length > 0) {
        return res.status(200).json({ sucesso: false, erro: 'Falha ao salvar: ' + erros.join(', ') });
      }
      return res.status(200).json({ sucesso: true });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });

  } catch (error) {
    console.error('configuracoes.js error:', error);
    return res.status(500).json({ sucesso: false, erro: error.message || String(error) });
  }
}
