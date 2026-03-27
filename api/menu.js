export default async function handler(req, res) {
  const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vYQjncMfOtRRrySBsI7new_gJN2frSG";

  try {
    // Adicionei 'count=exact' para sabermos se a tabela existe mas está vazia
    const url = `${SUPABASE_URL}/rest/v1/menu?select=*`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact' 
      }
    });

    const rawData = await response.json();

    // Se o retorno for vazio, pode ser que a tabela não tenha dados ou o RLS esteja bloqueando
    if (rawData.length === 0) {
       return res.status(200).json({ 
         aviso: "A tabela foi encontrada, mas retornou zero linhas. Verifique se há dados nela ou se o RLS está ativo.",
         dados_recebidos: rawData 
       });
    }

    const menuTratado = rawData.map(item => ({
      ordem: item.ordem || item.Ordem || item.ORDEM,
      descricao: item.descricao || item.Descricao || item.Descrição || item.Descricao,
      pagina: item.pagina || item.Pagina,
      icone: item.icone || 'bi-folder2'
    }));

    menuTratado.sort((a, b) => String(a.ordem).localeCompare(String(b.ordem), undefined, {numeric: true}));

    return res.status(200).json(menuTratado);

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
