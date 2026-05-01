// api/configuracoes.js
import { sb, validarSessao } from './_seguranca.js';

// Valores padrão para a agenda, usados caso o profissional ainda não tenha configurado
const DEFAULTS = {
  horario_inicio_agenda: '08:00',
  horario_fim_agenda:    '18:00',
  dias_agenda:           'SEG:TER:QUA:QUI:SEX',
  tempo_agenda:          '30'
};

export default async function handler(req, res) {
  // --- SEGURANÇA ---
  try { 
    await validarSessao(req); 
  } catch (e) { 
    return res.status(401).json({ sucesso: false, erro: e.message }); 
  }

  const { method, query } = req;
  const action = (query && query.action) ? String(query.action).toLowerCase() : '';

  try {
    // ---------------------------------------------------------
    // SEÇÃO: HOSPITAIS (CRUD)
    // ---------------------------------------------------------
    if (action === 'hospitais') {
      if (method === 'GET') {
        const { id } = query;
        const path = id 
          ? `hospitais?id=eq.${encodeURIComponent(id)}&select=*,contatos,telefones,endereco,created_at,updated_at` 
          : 'hospitais?select=*,contatos,telefones,endereco,created_at,updated_at&order=nome.asc';
        
        const { ok, status, data } = await sb(path);
        if (!ok) return res.status(status || 500).json({ sucesso: false, erro: 'Erro ao consultar hospitais' });

        const hospitals = data || [];
        if (hospitals.length > 0) {
          const ids = hospitals.map(h => h.id).filter(Boolean);
          const idsList = ids.join(',');
          const attPath = `hospitais_attachments?hospital_id=in.(${idsList})&select=id,hospital_id,titulo_item,nome,url,content_type,size,created_at&order=created_at.asc`;
          const { ok: ok2, data: attachments } = await sb(attPath);
          const atts = ok2 && attachments ? attachments : [];

          const map = {};
          atts.forEach(a => {
            if (!map[a.hospital_id]) map[a.hospital_id] = [];
            map[a.hospital_id].push(a);
          });

          hospitals.forEach(h => {
            h.anexos = map[h.id] || [];
            if (typeof h.contatos === 'string') {
              try { h.contatos = JSON.parse(h.contatos); } catch(e) { h.contatos = []; }
            } else if (!h.contatos) {
              h.contatos = [];
            }
          });
        }
        return res.status(200).json({ sucesso: true, dados: hospitals });
      }

      if (method === 'POST') {
        const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
        if (!body || !body.nome) return res.status(400).json({ sucesso:false, erro: 'Campo nome obrigatório' });
        const payload = {
          nome: String(body.nome).trim(),
          telefones: body.telefones || '',
          endereco: body.endereco || '',
          contatos: body.contatos || []
        };
        const { ok, status, data, error } = await sb('hospitais', 'POST', payload, { 'Prefer': 'return=representation' });
        return res.status(200).json({ sucesso: ok, id: data?.[0]?.id, dados: data, erro: error });
      }

      if (method === 'PATCH') {
        const { id } = query;
        const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
        const allowed = {};
        if ('nome' in body) allowed.nome = String(body.nome || '').trim();
        if ('telefones' in body) allowed.telefones = body.telefones || '';
        if ('endereco' in body) allowed.endereco = body.endereco || '';
        if ('contatos' in body) allowed.contatos = body.contatos || [];
        const { ok, status, error } = await sb(`hospitais?id=eq.${encodeURIComponent(id)}`, 'PATCH', allowed);
        return res.status(200).json({ sucesso: ok, erro: error });
      }

      if (method === 'DELETE') {
        const { ok, error } = await sb(`hospitais?id=eq.${encodeURIComponent(query.id)}`, 'DELETE');
        return res.status(200).json({ sucesso: ok, erro: error });
      }
    }

    // ---------------------------------------------------------
    // SEÇÃO: ANEXOS (UPLOAD / EXCLUSÃO / EDIÇÃO)
    // ---------------------------------------------------------
    else if (action === 'upload_anexo') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { hospital_id, nome_arquivo, tipo_arquivo, arquivo_base64, titulo_item } = body;
      const buffer = Buffer.from(arquivo_base64, 'base64');
      const storagePath = `${hospital_id}/${Date.now()}_${nome_arquivo}`;
      
      const storageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/hospitais/${storagePath}`;
      const up = await fetch(storageUrl, {
        method: 'POST',
        body: buffer,
        headers: { 'Authorization': `Bearer ${process.env.SUPABASE_KEY}`, 'Content-Type': tipo_arquivo }
      });

      if (!up.ok) return res.status(up.status).json({ sucesso: false, erro: 'Erro no Storage' });
      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/hospitais/${storagePath}`;

      const { ok, error } = await sb('hospitais_attachments', 'POST', {
        hospital_id: parseInt(hospital_id),
        titulo_item: titulo_item || nome_arquivo,
        nome: nome_arquivo,
        url: publicUrl,
        content_type: tipo_arquivo,
        size: buffer.length
      });
      return res.status(200).json({ sucesso: ok, erro: error });
    }

    else if (action === 'excluir_anexo') {
      const { data: anexo } = await sb(`hospitais_attachments?id=eq.${query.id}&select=url`);
      if (anexo?.[0]) {
        const path = anexo[0].url.split('/public/hospitais/')[1];
        await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/hospitais/${path}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` }
        });
      }
      const { ok } = await sb(`hospitais_attachments?id=eq.${query.id}`, 'DELETE');
      return res.status(200).json({ sucesso: ok });
    }

    else if (action === 'editar_anexo') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { ok } = await sb(`hospitais_attachments?id=eq.${query.id}`, 'PATCH', { titulo_item: body.titulo_item });
      return res.status(200).json({ sucesso: ok });
    }

    // ---------------------------------------------------------
    // SEÇÃO: CID E CONFIGURAÇÕES DE AGENDA
    // ---------------------------------------------------------
    else if (action === 'buscar_cid') {
      const termo = query.termo;
      if (!termo) return res.status(200).json([]);
      const t = encodeURIComponent(String(termo).trim());
      const { ok, data } = await sb(`cid?or=(codigo.ilike.*${t}*,descricao.ilike.*${t}*)&limit=10&select=codigo,descricao`);
      return res.status(200).json(ok ? data || [] : []);
    }

    // Se nenhuma "action" específica for disparada, tratamos a Agenda do Profissional
    else {
      const { id_profissional } = query;
      
      if (method === 'GET' && id_profissional) {
        const { ok, data } = await sb(`configuracoes?id_profissional=eq.${id_profissional}&select=chave_config,valor`);
        const cfg = { ...DEFAULTS }; 
        if (ok && data) { 
          data.forEach(r => { cfg[r.chave_config] = r.valor; }); 
        }
        return res.status(200).json({ sucesso: true, config: cfg });
      }

      if (method === 'PUT' && id_profissional) {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const chaves = Object.keys(DEFAULTS);
        const erros = [];

        for (const chave of chaves) {
          if (!(chave in body)) continue;
          const valor = String(body[chave] || '').trim();
          const { data: exist } = await sb(`configuracoes?id_profissional=eq.${id_profissional}&chave_config=eq.${chave}&select=chave_config`);
          
          if (exist && exist.length > 0) {
            const { ok } = await sb(`configuracoes?id_profissional=eq.${id_profissional}&chave_config=eq.${chave}`, 'PATCH', { valor });
            if (!ok) erros.push(chave);
          } else {
            const { ok } = await sb('configuracoes', 'POST', { id_profissional: parseInt(id_profissional), chave_config: chave, valor });
            if (!ok) erros.push(chave);
          }
        }
        return res.status(200).json({ sucesso: erros.length === 0 });
      }
    }

    // Fallback caso não entre em nenhuma condição
    return res.status(405).json({ erro: 'Ação ou Método não permitido' });

  } catch (error) {
    console.error('configuracoes.js error:', error);
    return res.status(500).json({ sucesso: false, erro: error.message || String(error) });
  }
}
