
// api/config_atendimento.js  — versão 3 (blocos independentes + todos os tipos)
import { sb, validarSessao } from './_seguranca.js';

const TABLE = {
  tipo:        'config_tipos_consulta',
  componente:  'config_componentes',
  vincular:    'config_tipo_componentes',
  bloco:       'config_blocos_tipo',
  medicamento: 'config_medicamentos',
  exame:       'config_exames',
};

export default async function handler(req, res) {
  try { await validarSessao(req); } catch (e) {
    return res.status(401).json({ erro: e.message });
  }

  const { method, query } = req;
  const { action, id, tipo_id, secao, busca, grupo, subtipo } = query;

  try {
    // ─── GET ─────────────────────────────────────────────────────
    if (method === 'GET') {
      if (action === 'profissional_por_email' && query.email) {
        const { ok, data } = await sb(
          `usuarios?email=eq.${encodeURIComponent(query.email)}&select=id_profissional,nome,especialidade,crm&limit=1`
        );
        const prof = ok && data && data[0] ? data[0] : null;
        return res.status(200).json(prof || {});
      }

      if (action === 'config' && query.id_profissional) {
        const { ok, data } = await sb(
          `configuracoes?id_profissional=eq.${query.id_profissional}&select=chave_config,valor`
        );
        if (ok && data) {
          const obj = {};
          data.forEach(item => { obj[item.chave_config] = item.valor; });
          return res.status(200).json(obj);
        }
        return res.status(200).json({});
      }

      if (action === 'tipos') {
        const { ok, data } = await sb('config_tipos_consulta?order=ordem.asc,nome.asc&select=*');
        return res.status(200).json(ok ? data || [] : []);
      }

      if (action === 'componentes') {
        const filtroSecao = secao ? `&secao=eq.${secao}` : '';
        const { ok, data } = await sb(`config_componentes?order=ordem.asc,nome.asc${filtroSecao}&select=*`);
        return res.status(200).json(ok ? data || [] : []);
      }

      if (action === 'tipos_com_componentes') {
        const { ok, data } = await sb('config_componentes?select=secao&order=secao.asc');
        if (!ok) return res.status(200).json([]);
        const uniq = [...new Set((data || []).map(r => r.secao))];
        return res.status(200).json(uniq);
      }

      if (action === 'tipo_componentes' && tipo_id) {
        const { ok, data } = await sb(
          `config_tipo_componentes?tipo_id=eq.${tipo_id}&order=ordem.asc` +
          `&select=id,tipo_id,componente_id,ativo,ordem,tipo_vinculo,componente:config_componentes(id,nome,secao,icone,valor_default,unidade,ordem,tipo_componente,formula_tipo,formula_config)` +
          (secao ? `&componente.secao=eq.${encodeURIComponent(secao)}` : '')
        );
        let result = ok ? data || [] : [];
        if (secao) result = result.filter(v => v.componente && v.componente.secao === secao);
        return res.status(200).json(result);
      }

      if (action === 'blocos' && tipo_id) {
        const { ok, data } = await sb(`config_blocos_tipo?tipo_id=eq.${tipo_id}&order=numero_bloco.asc&select=*`);
        return res.status(200).json(ok ? data || [] : []);
      }

      if (action === 'medicamentos') {
        let url = 'config_medicamentos?order=nome.asc&select=*';
        if (busca) url += `&nome=ilike.*${busca}*`;
        const { ok, data } = await sb(url);
        return res.status(200).json(ok ? data || [] : []);
      }

      if (action === 'exames') {
        let url = 'config_exames?order=grupo.asc,nome.asc&select=*';
        if (busca) url += `&or=(nome.ilike.*${busca}*,grupo.ilike.*${busca}*)`;
        if (grupo) url += `&grupo=eq.${grupo}`;
        if (subtipo) url += `&subtipo=eq.${subtipo}`;
        const { ok, data } = await sb(url);
        return res.status(200).json(ok ? data || [] : []);
      }
    }

    // ─── POST ─────────────────────────────────────────────────────
    if (method === 'POST') {
      // CASO ESPECIAL: IMPORTAÇÃO DE PLANILHA
      if (action === 'importar_planilha') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { registros } = body;

        if (!Array.isArray(registros) || registros.length === 0) {
          return res.status(400).json({ sucesso: false, erro: 'Nenhum registro para importar' });
        }

        const resultados = {
          agenda: { sucesso: 0, erro: 0, detalhes: [] },
          atendimentos: { sucesso: 0, erro: 0, detalhes: [] }
        };

        for (const reg of registros) {
          try {
            const pcodNumerico = reg.pcod ? parseInt(String(reg.pcod).replace(/\D/g, '')) : null;
            let pacienteNome = '';
            if (pcodNumerico) {
              const rPac = await sb(`pacientes?pcod=eq.${pcodNumerico}&select=Nome`);
              pacienteNome = rPac.ok && rPac.data && rPac.data[0] ? rPac.data[0].Nome : `Paciente #${pcodNumerico}`;
            } else {
              pacienteNome = 'Paciente não identificado';
            }

            let dataFormatada = '';
            if (reg.data) {
              const partes = String(reg.data).split('/');
              if (partes.length === 3) {
                const [dia, mes, ano] = partes;
                dataFormatada = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
              }
            }

            if (!dataFormatada || dataFormatada.includes('NaN')) {
              resultados.agenda.erro++;
              continue;
            }

            const agendaPayload = {
              id_profissional: 1,
              data_agenda: dataFormatada,
              paciente_id: pcodNumerico,
              paciente_nome: pacienteNome,
              hora_agenda: '12:00',
              tipo: reg.consulta || 'CONSULTA',
              modalidade: 'PRESENCIAL',
              status: 'ATENDIDO',
              convenio: reg.convenio || '',
              observacao: reg.obs || '',
              is_encaixe: false,
              is_bloqueado: false
            };

            const rAgenda = await sb('agenda', 'POST', agendaPayload, { 'Prefer': 'return=representation' });
            const agendaId = rAgenda.ok && rAgenda.data && rAgenda.data[0] ? rAgenda.data[0].id : null;

            if (rAgenda.ok && agendaId) {
              resultados.agenda.sucesso++;
              const atendimentoPayload = {
                agenda_id: agendaId,
                paciente_id: pcodNumerico,
                data_atendimento: dataFormatada,
                tipo_consulta_nome: reg.consulta || 'CONSULTA',
                medico_inicio_nome: reg.medico || 'Dr. Francesco Zanotto',
                medico_fim_nome: 'Dr. Francesco Zanotto',
                bloco1_texto: reg.obs || '',
                bloco2_texto: reg.convenio || '',
                status: 'ENCERRADO'
              };
              const rAtend = await sb('atendimentos', 'POST', atendimentoPayload);
              if (rAtend.ok) resultados.atendimentos.sucesso++;
              else resultados.atendimentos.erro++;
            } else {
              resultados.agenda.erro++;
            }
          } catch (e) {
            resultados.agenda.erro++;
          }
        }
        return res.status(200).json({ sucesso: true, resultados });
      }

      // POST NORMAL
      const table = TABLE[action];
      if (!table) return res.status(400).json({ erro: 'action inválido' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const prefer = action === 'bloco' ? 'resolution=merge-duplicates,return=representation' : 'return=representation';
      const { ok, data } = await sb(table, 'POST', body, { 'Prefer': prefer });
      if (!ok) return res.status(200).json({ sucesso: false, erro: JSON.stringify(data) });
      const criado = Array.isArray(data) ? data[0] : data;
      return res.status(200).json({ sucesso: true, id: criado?.id, dados: criado });
    }

    // ─── PATCH ────────────────────────────────────────────────────
    if (method === 'PATCH') {
      if (!id) return res.status(400).json({ erro: 'id obrigatório' });
      const table = TABLE[action];
      if (!table) return res.status(400).json({ erro: 'action inválido' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { ok, data } = await sb(`${table}?id=eq.${id}`, 'PATCH', body, { 'Prefer': 'return=minimal' });
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false, erro: JSON.stringify(data) });
    }

    // ─── DELETE ───────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ erro: 'id obrigatório' });
      const table = TABLE[action];
      if (!table) return res.status(400).json({ erro: 'action inválido' });
      const { ok } = await sb(`${table}?id=eq.${id}`, 'DELETE');
      return res.status(200).json(ok ? { sucesso: true } : { sucesso: false });
    }

    return res.status(405).json({ erro: 'Método não permitido' });

  } catch (error) {
    console.error('config_atendimento.js error:', error);
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
