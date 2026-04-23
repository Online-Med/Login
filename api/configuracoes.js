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
  try { await validarSessao(req); } catch (e) { return res.status(401).json({ erro: e.message }); }

  const { method, query } = req;

  try {

// ── GET ──────────────────────────────────────────────────────
    if (method === 'GET') {
      const { id_profissional, action, termo } = query;

      // 1. Prioridade Total: Busca de CID
      if (action === 'buscar_cid') {
        if (!termo) return res.status(200).json([]);
        
        const { ok, data } = await sb(
          `cid?or=(codigo.ilike.*${termo}*,nome.ilike.*${termo}*)&limit=10&select=codigo,nome`
        );
        
        // O "return" aqui é CRUCIAL para não executar o código debaixo
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
    // Faz upsert: atualiza se existe, insere se não existe (por chave)
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
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
