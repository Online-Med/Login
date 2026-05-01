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
  // Valida se o usuário está autenticado antes de prosseguir
  try { 
    await validarSessao(req); 
  } catch (e) { 
    return res.status(401).json({ sucesso: false, erro: e.message }); 
  }

  const { method, query } = req;
  // Define a ação baseada no parâmetro 'action' da URL (ex: ?action=hospitais)
  const action = (query && query.action) ? String(query.action).toLowerCase() : '';

  try {
    // ---------------------------------------------------------
    // SEÇÃO: HOSPITAIS (CRUD)
    // ---------------------------------------------------------
    if (action === 'hospitais') {
      
      // LISTAGEM E BUSCA
      if (method === 'GET') {
        const { id } = query;
        // Monta o caminho para buscar um hospital específico ou a lista completa
        const path = id 
          ? `hospitais?id=eq.${encodeURIComponent(id)}&select=*,contatos,telefones,endereco,created_at,updated_at` 
          : 'hospitais?select=*,contatos,telefones,endereco,created_at,updated_at&order=nome.asc';
        
        const { ok, status, data } = await sb(path);
        if (!ok) return res.status(status || 500).json({ sucesso: false, erro: 'Erro ao consultar hospitais' });

        const hospitals = data || [];
        if (!hospitals.length) return res.status(200).json({ sucesso: true, dados: hospitals });

        // Coleta IDs para buscar os anexos (arquivos) vinculados a esses hospitais
        const ids = hospitals.map(h => h.id).filter(Boolean);
        if (ids.length > 0) {
          const idsList = ids.join(',');
          const attPath = `hospitais_attachments?hospital_id=in.(${idsList})&select=id,hospital_id,titulo_item,nome,url,content_type,size,created_at&order=created_at.asc`;
          const { ok: ok2, data: attachments } = await sb(attPath);
          const atts = ok2 && attachments ? attachments : [];

          // Agrupa os anexos por ID de hospital para facilitar a mesclagem
          const map = {};
          atts.forEach(a => {
            if (!map[a.hospital_id]) map[a.hospital_id] = [];
            map[a.hospital_id].push(a);
          });

          // Insere os anexos e faz o parse do JSON de contatos em cada hospital
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

      // CRIAÇÃO DE HOSPITAL
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
        if (!ok) return res.status(status || 500).json({ sucesso:false, erro: error || 'Erro ao criar hospital' });

        const newId = Array.isArray(data) && data[0] ? data[0].id : null;
        return res.status(200).json({ sucesso: true, id: newId, dados: data });
      }

      // ATUALIZAÇÃO DE HOSPITAL
      if (method === 'PATCH') {
        const { id } = query;
        if (!id) return res.status(400).json({ sucesso:false, erro: 'id obrigatório' });
        const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;

        const allowed = {}; // Filtra apenas campos permitidos para evitar updates indevidos
        if ('nome' in body) allowed.nome = String(body.nome || '').trim();
        if ('telefones' in body) allowed.telefones = body.telefones || '';
        if ('endereco' in body) allowed.endereco = body.endereco || '';
        if ('contatos' in body) allowed.contatos = body.contatos || [];

        const { ok, status, error } = await sb(`hospitais?id=eq.${encodeURIComponent(id)}`, 'PATCH', allowed, { 'Prefer': 'return=minimal' });
        if (!ok) return res.status(status || 500).json({ sucesso:false, erro: error || 'Erro ao atualizar' });
        return res.status(200).json({ sucesso: true });
      }

      // EXCLUSÃO DE HOSPITAL
      if (method === 'DELETE') {
        const { id } = query;
        if (!id) return res.status(400).json({ sucesso:false, erro: 'id obrigatório' });
        const { ok, status, error } = await sb(`hospitais?id=eq.${encodeURIComponent(id)}`, 'DELETE');
        if (!ok) return res.status(status || 500).json({ sucesso:false, erro: error || 'Erro ao excluir' });
        return res.status(200).json({ sucesso: true });
      }
    }

    // ---------------------------------------------------------
    // SEÇÃO: UPLOAD DE ARQUIVO (ACTION: upload_anexo)
    // ---------------------------------------------------------

if (action === 'upload_anexo') {
      if (method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

      try {
        const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
        const { hospital_id, nome_arquivo, tipo_arquivo, arquivo_base64, titulo_item, tamanho } = body;

        // Validação Manual das Variáveis (Impede o erro 500 silencioso)
        const s_url = process.env.SUPABASE_URL;
        const s_key = process.env.SUPABASE_KEY;

        if (!s_url || !s_key) {
          console.error("ERRO CRÍTICO: Variáveis de ambiente não encontradas no processo!");
          return res.status(500).json({ 
            sucesso: false, 
            erro: `Configuração incompleta. URL: ${!!s_url}, KEY: ${!!s_key}` 
          });
        }

        const buffer = Buffer.from(arquivo_base64, 'base64');
        const storagePath = `${hospital_id}/${Date.now()}_${nome_arquivo}`;
        const baseUrl = s_url.replace(/\/$/, '');
        const storageUrl = `${baseUrl}/storage/v1/object/hospitais/${storagePath}`;

        console.log("Iniciando fetch para Storage...");

        const response = await fetch(storageUrl, {
          method: 'POST',
          body: buffer,
          headers: {
            'Authorization': `Bearer ${s_key}`,
            'Content-Type': tipo_arquivo || 'application/octet-stream',
            'x-user-email': req.headers['x-user-email'] || ''
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Supabase Storage recusou:", response.status, errorText);
          return res.status(response.status).json({ sucesso: false, erro: "Supabase: " + errorText });
        }

        const publicUrl = `${baseUrl}/storage/v1/object/public/hospitais/${storagePath}`;
        
        // Registro no banco
        const metadata = {
          hospital_id: parseInt(hospital_id),
          titulo_item: titulo_item || nome_arquivo,
          nome: nome_arquivo,
          url: publicUrl,
          content_type: tipo_arquivo || '',
          size: tamanho || buffer.length
        };

        const { ok: dbOk, error: dbError } = await sb('hospitais_attachments', 'POST', metadata);
        
        if (!dbOk) {
          console.error("Erro ao registrar metadados:", dbError);
          return res.status(500).json({ sucesso: false, erro: "Arquivo subiu, mas falhou registro no banco." });
        }

        return res.status(200).json({ sucesso: true, url: publicUrl });

      } catch (err) {
        console.error("Falha total no upload:", err.message);
        return res.status(500).json({ sucesso: false, erro: "Exceção no servidor: " + err.message });
      }
    }

    

    // ---------------------------------------------------------
    // SEÇÃO: CONFIGURAÇÕES GERAIS E BUSCA DE CID
    // ---------------------------------------------------------
    if (method === 'GET') {
      const { id_profissional, action: act, termo } = query;

      // Busca códigos CID por termo de pesquisa
      if (act === 'buscar_cid') {
        if (!termo) return res.status(200).json([]);
        const t = encodeURIComponent(String(termo||'').trim());
        const { ok, data } = await sb(`cid?or=(codigo.ilike.*${t}*,descricao.ilike.*${t}*)&limit=10&select=codigo,descricao`);
        return res.status(200).json(ok ? data || [] : []);
      }

      // Retorna as configurações de agenda do profissional
      if (!id_profissional) return res.status(400).json({ erro: 'id_profissional obrigatório.' });
      const { ok, data } = await sb(`configuracoes?id_profissional=eq.${id_profissional}&select=chave_config,valor`);
      const cfg = { ...DEFAULTS }; // Começa com os padrões e sobrescreve com o que houver no banco
      if (ok && data) { 
        data.forEach(r => { cfg[r.chave_config] = r.valor; }); 
      }
      return res.status(200).json({ sucesso: true, config: cfg });
    }

    // Salva ou atualiza configurações (Agenda)
    if (method === 'PUT') {
      const { id_profissional } = query;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const chaves = Object.keys(DEFAULTS);
      const erros = [];

      for (const chave of chaves) {
        if (!(chave in body)) continue;
        const valor = String(body[chave] || '').trim();
        
        // Verifica se a configuração já existe para decidir entre POST (novo) ou PATCH (atualizar)
        const { data: exist } = await sb(`configuracoes?id_profissional=eq.${id_profissional}&chave_config=eq.${chave}&select=chave_config`);
        
        if (exist && exist.length > 0) {
          const { ok } = await sb(`configuracoes?id_profissional=eq.${id_profissional}&chave_config=eq.${chave}`, 'PATCH', { valor }, { 'Prefer': 'return=minimal' });
          if (!ok) erros.push(chave);
        } else {
          const { ok } = await sb('configuracoes', 'POST', { id_profissional: parseInt(id_profissional), chave_config: chave, valor }, { 'Prefer': 'return=minimal' });
          if (!ok) erros.push(chave);
        }
      }
      return res.status(200).json({ sucesso: erros.length === 0 });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });

  } catch (error) {
    console.error('configuracoes.js error:', error);
    return res.status(500).json({ sucesso: false, erro: error.message || String(error) });
  }
}
