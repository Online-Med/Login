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
    // --- BUSCAR/LISTAR ---
    if (method === 'GET') {
      const { pcod } = query;
      if (pcod) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?select=*&pcod=eq.${pcod}`, { headers });
        const d = await r.json();
        return res.status(200).json({ sucesso: true, paciente: d[0] });
      }
      // Logica de listagem (simplificada para o exemplo)
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?select=*&order=pcod.desc&limit=10`, { headers });
      const d = await r.json();
      return res.status(200).json({ sucesso: true, dados: d });
    }

    // --- RESERVAR (POST) ---
    if (method === 'POST') {
      // 1. Busca o maior PCOD
      const rMax = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?select=pcod&order=pcod.desc&limit=1`, { headers });
      const ultimo = await rMax.json();
      const novoPcod = (ultimo.length > 0) ? (parseInt(ultimo[0].pcod) + 1) : 1;

      // 2. Cria a reserva
      const reserva = { 
        pcod: novoPcod, 
        Nome: "RESERVADO - AGUARDANDO DADOS",
        Data_Cadastro: new Date().toISOString() 
      };
      await fetch(`${SUPABASE_URL}/rest/v1/pacientes`, { method: 'POST', headers, body: JSON.stringify(reserva) });
      
      return res.status(200).json({ sucesso: true, pcod: novoPcod });
    }

    // --- SALVAR DADOS (PATCH) ---
    if (method === 'PATCH') {
      const { pcod } = query;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?pcod=eq.${pcod}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(req.body)
      });
      if (r.ok) return res.status(200).json({ sucesso: true });
    }

    // --- EXCLUIR RESERVA (DELETE) ---
    if (method === 'DELETE') {
      const { pcod } = query;
      await fetch(`${SUPABASE_URL}/rest/v1/pacientes?pcod=eq.${pcod}`, { method: 'DELETE', headers });
      return res.status(200).json({ sucesso: true });
    }

  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
