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
      // GET -> lista ou 1 registro (com anexos embutidos)
      if (method === 'GET') {
        const { id } = query;
        // fetch hospitals
        const path = id ? `hospitais?id=eq.${encodeURIComponent(id)}&select=*,contatos,telefones,endereco,created_at,updated_at` : 'hospitais?select=*,contatos,telefones,endereco,created_at,updated_at&order=nome.asc';
        const { ok, status, data } = await sb(path);
        if (!ok) return res.status(status || 500).json({ sucesso: false, erro: 'Erro ao consultar hospitais' });

        const hospitals = data || [];

        // se não houver hospitais, já retorna
        if (!hospitals.length) return res.status(200).json({ sucesso: true, dados: hospitals });

        // buscar anexos para todos os hospitais retornados
        const ids = hospitals.map(h => h.id).filter(Boolean);
        if (ids.length === 0) return res.status(200).json({ sucesso: true, dados: hospitals });

        // formatar os ids para in.(1,2,3)
        const idsList = ids.join(',');
        const attPath = `hospitais_attachments?hospital_id=in.(${idsList})&select=id,hospital_id,titulo_item,nome,url,content_type,size,created_at&order=created_at.asc`;
        const { ok: ok2, data: attachments } = await sb(attPath);
        const atts = ok2 && attachments ? attachments : [];

        // mapear anexos por hospital_id
        const map = {};
        atts.forEach(a => {
          const hid = a.hospital_id;
          if (!map[hid]) map[hid] = [];
          map[hid].push(a);
        });

        // atribuir anexos a cada hospital
        hospitals.forEach(h => {
          h.anexos = map[h.id] || [];
          // normalizar contatos (pode ser JSONB ou string)
          if (typeof h.contatos === 'string') {
            try { h.contatos = JSON.parse(h.contatos); } catch(e) { h.contatos = []; }
          } else if (!h.contatos) {
            h.contatos = [];
          }
        });

        return res.status(200).json({ sucesso: true, dados: hospitals });
      }

      // POST -> cria novo hospital (aceita contatos como JSON no body)
      if (method === 'POST') {
        const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
        if (!body || !body.nome) return res.status(400).json({ sucesso:false, erro: 'Campo nome obrigatório' });

        // concordar com campos aceitos pelo esquema: nome, telefones, endereco, contatos (JSONB)
        const payload = {
          nome: String(body.nome).trim(),
          telefones: body.telefones || '',
          endereco: body.endereco || '',
          contatos: body.contatos || []
        };

        const { ok, status, data, error } = await sb(
          'hospitais',
          'POST',
          payload,
          { 'Prefer': 'return=representation' }
        );

        if (!ok) {
          return res.status(status || 500).json({ sucesso:false, erro: error || 'Erro ao criar hospital' });
        }

        const newId = Array.isArray(data) && data[0] ? data[0].id : null;
        return res.status(200).json({ sucesso: true, id: newId, dados: data });
      }

      // PATCH -> atualiza hospital (aceita contatos JSON)
      if (method === 'PATCH') {
        const { id } = query;
        if (!id) return res.status(400).json({ sucesso:false, erro: 'id obrigatório' });
        const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;

        // construir payload apenas com campos permitidos
        const allowed = {};
        if ('nome' in body) allowed.nome = String(body.nome || '').trim();
        if ('telefones' in body) allowed.telefones = body.telefones || '';
        if ('endereco' in body) allowed.endereco = body.endereco || '';
        if ('contatos' in body) allowed.contatos = body.contatos || [];

        if (Object.keys(allowed).length === 0) return res.status(400).json({ sucesso:false, erro: 'Nenhum campo para atualizar' });

        const { ok, status, error } = await sb(`hospitais?id=eq.${encodeURIComponent(id)}`, 'PATCH', allowed, { 'Prefer': 'return=minimal' });
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

        // espera body JSON: { anexos: [{ titulo_item, nome, url, content_type, size }, ...] }
        const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
        const anexos = (body && Array.isArray(body.anexos)) ? body.anexos : null;
        if (!anexos || anexos.length === 0) return res.status(400).json({ sucesso:false, erro: 'Nenhum anexo informado' });

        // prepara payload (mapear hospital_id)
        const payload = anexos.map(a => ({
          hospital_id: parseInt(hospital_id),
          titulo_item: a.titulo_item || (a.nome || '').split('.').shift(),
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
    // NOVO BLOCO: Upload de Arquivo Físico
    // -----------------------
    if (action === 'upload_anexo') {
      if (method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });
      // Rota para o frontend realizar o upload via servidor
      return res.status(200).json({ sucesso: true, mensagem: 'Rota de upload ativa' });
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
