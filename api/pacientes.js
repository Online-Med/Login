// api/pacientes.js
import { SUPABASE_URL, sbHeaders, sb, validarSessao } from './_seguranca.js';

export default async function handler(req, res) {
  try { 
    await validarSessao(req); 
  } catch (e) { 
    return res.status(401).json({ erro: e.message }); 
  }

  const { method, query } = req;

  try {
    if (method === 'GET') {
      const { pcod, nome, documento, celular, pagina } = query;
      const itensPorPagina = 10;
      const de  = (parseInt(pagina) || 0) * itensPorPagina;
      const ate = de + (itensPorPagina - 1);

      // --- USANDO A NOVA URL API PARA EVITAR O AVISO DO VERCEL ---
      const url = new URL(`${SUPABASE_URL}/rest/v1/pacientes`);

      if (pcod) {
        url.searchParams.set('select', '*');
        url.searchParams.set('pcod', `eq.${pcod}`);
        const r = await fetch(url.toString(), { headers: sbHeaders });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, paciente: d[0] });
      }

      // Configuração padrão de listagem
      url.searchParams.set('select', '*');
      url.searchParams.set('order', 'pcod.desc');

      if (nome) {
        if (!isNaN(nome)) {
          url.searchParams.set('pcod', `eq.${nome}`);
        } else {
          url.searchParams.set('Nome', `ilike.*${nome}*`);
        }
      }

      if (documento) {
        const semPonto = documento.toString().replace(/\D/g, '');
        let parcial = semPonto;
        if (semPonto.length > 9)      parcial = semPonto.slice(0,3)+'.'+semPonto.slice(3,6)+'.'+semPonto.slice(6,9)+'-'+semPonto.slice(9);
        else if (semPonto.length > 6) parcial = semPonto.slice(0,3)+'.'+semPonto.slice(3,6)+'.'+semPonto.slice(6);
        else if (semPonto.length > 3) parcial = semPonto.slice(0,3)+'.'+semPonto.slice(3);
        
        url.searchParams.set('or', `(Documento.ilike.*${semPonto}*,Documento.ilike.*${parcial}*)`);
      }

      if (celular) {
        const limpo = celular.toString().replace(/\D/g, '');
        url.searchParams.set('or', `(Celular.ilike.*${limpo}*,Telefone.ilike.*${limpo}*)`);
      }

      const r = await fetch(url.toString(), {
        headers: { ...sbHeaders, 'Range': `${de}-${ate}`, 'Prefer': 'count=exact' }
      });

      const d = await r.json();
      const contentRange = r.headers.get('content-range');
      const totalRegistros = contentRange ? parseInt(contentRange.split('/')[1]) : d.length;

      return res.status(200).json({ 
        sucesso: true, 
        dados: d, 
        total: totalRegistros, 
        paginas: Math.ceil(totalRegistros / itensPorPagina) 
      });
    }

    if (method === 'POST') {
      const urlMax = new URL(`${SUPABASE_URL}/rest/v1/pacientes`);
      urlMax.searchParams.set('select', 'pcod');
      urlMax.searchParams.set('order', 'pcod.desc');
      urlMax.searchParams.set('limit', '1');

      const rMax = await fetch(urlMax.toString(), { headers: sbHeaders });
      const ultimo = await rMax.json();
      
      const novoPcod = (ultimo.length > 0) ? (parseInt(ultimo[0].pcod) + 1) : 1;
      const reserva = { 
        pcod: novoPcod, 
        Nome: "RESERVADO - AGUARDANDO DADOS", 
        Data_Cadastro: new Date().toISOString() 
      };

      await fetch(`${SUPABASE_URL}/rest/v1/pacientes`, { 
        method: 'POST', 
        headers: sbHeaders, 
        body: JSON.stringify(reserva) 
      });

      return res.status(200).json({ sucesso: true, pcod: novoPcod });
    }

    if (method === 'PATCH') {
      const { pcod } = query;
      const urlPatch = new URL(`${SUPABASE_URL}/rest/v1/pacientes`);
      urlPatch.searchParams.set('pcod', `eq.${pcod}`);

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      const r = await fetch(urlPatch.toString(), {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(body)
      });

      const d = await r.json();
      return (r.ok && d.length > 0)
        ? res.status(200).json({ sucesso: true })
        : res.status(400).json({ sucesso: false, erro: "Erro ao gravar." });
    }

    if (method === 'DELETE') {
      const { pcod } = query;
      const urlDel = new URL(`${SUPABASE_URL}/rest/v1/pacientes`);
      urlDel.searchParams.set('pcod', `eq.${pcod}`);

      await fetch(urlDel.toString(), { method: 'DELETE', headers: sbHeaders });
      return res.status(200).json({ sucesso: true });
    }

  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
