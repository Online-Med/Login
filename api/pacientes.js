export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";
  const { method, query } = req;

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // --- LISTAR PACIENTES (GET) ---
    if (method === 'GET') {
      const { pcod, nome, documento, celular, pagina } = query;
      
      const itensPorPagina = 10;
      const de = (parseInt(pagina) || 0) * itensPorPagina;
      const ate = de + (itensPorPagina - 1);

      if (pcod) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?select=*&pcod=eq.${pcod}`, { headers });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, paciente: d[0] });
      }

      // Montagem da URL base
      let urlFiltro = `${SUPABASE_URL}/rest/v1/pacientes?select=*&order=pcod.desc`;

      // 1. FILTRO POR NOME OU CÓDIGO (Igual ao GS)
      if (nome) {
        const ehNumero = !isNaN(nome);
        if (ehNumero) {
          urlFiltro += `&pcod=eq.${nome}`;
        } else {
          urlFiltro += `&Nome=ilike.*${nome}*`;
        }
      }

      // 2. FILTRO POR DOCUMENTO (CPF) - Adaptado do seu GS
      if (documento) {
        const semPonto = documento.toString().replace(/\D/g, '');
        let parcialFormatado = semPonto;

        // Recria a lógica de formatação de máscara que você tinha no GS
        if (semPonto.length > 9) {
          parcialFormatado = semPonto.slice(0,3) + '.' + semPonto.slice(3,6) + '.' + semPonto.slice(6,9) + '-' + semPonto.slice(9);
        } else if (semPonto.length > 6) {
          parcialFormatado = semPonto.slice(0,3) + '.' + semPonto.slice(3,6) + '.' + semPonto.slice(6);
        } else if (semPonto.length > 3) {
          parcialFormatado = semPonto.slice(0,3) + '.' + semPonto.slice(3);
        }
        
        // No Supabase, usamos o operador 'or' para buscar com e sem máscara ao mesmo tempo
        urlFiltro += `&or=(Documento.ilike.*${semPonto}*,Documento.ilike.*${parcialFormatado}*)`;
      }

      // 3. FILTRO POR CELULAR/TELEFONE - Adaptado do seu GS
      if (celular) {
        const buscaLimpa = celular.toString().replace(/\D/g, '');
        // Busca o número limpo dentro dos campos Celular ou Telefone
        urlFiltro += `&or=(Celular.ilike.*${buscaLimpa}*,Telefone.ilike.*${buscaLimpa}*)`;
      }

      const r = await fetch(urlFiltro, { 
        headers: { 
          ...headers, 
          'Range': `${de}-${ate}`,
          'Prefer': 'count=exact' 
        } 
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

    // --- RESTANTE DOS MÉTODOS (POST, PATCH, DELETE) ---
    // (Mantive igual ao seu código original para não alterar a lógica de reserva e salvamento)
    if (method === 'POST') {
      const rMax = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?select=pcod&order=pcod.desc&limit=1`, { headers });
      const ultimo = await rMax.json();
      const novoPcod = (ultimo.length > 0) ? (parseInt(ultimo[0].pcod) + 1) : 1;
      const reserva = { pcod: novoPcod, Nome: "RESERVADO - AGUARDANDO DADOS", Data_Cadastro: new Date().toISOString() };
      await fetch(`${SUPABASE_URL}/rest/v1/pacientes`, { method: 'POST', headers, body: JSON.stringify(reserva) });
      return res.status(200).json({ sucesso: true, pcod: novoPcod });
    }

    if (method === 'PATCH') {
      const { pcod } = query;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?pcod=eq.${pcod}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(req.body)
      });
      const d = await r.json();
      return (r.ok && d.length > 0) ? res.status(200).json({ sucesso: true }) : res.status(400).json({ sucesso: false, erro: "Erro ao gravar." });
    }

    if (method === 'DELETE') {
      const { pcod } = query;
      await fetch(`${SUPABASE_URL}/rest/v1/pacientes?pcod=eq.${pcod}`, { method: 'DELETE', headers });
      return res.status(200).json({ sucesso: true });
    }

  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
