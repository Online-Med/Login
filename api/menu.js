import { validarEBuscaDados } from './seguranca.js';

export default async function handler(req, res) {
  try {
    // 1. A função centralizada valida o e-mail no cabeçalho e busca os dados
    // usando a SERVICE_KEY (ignorando o RLS de forma segura no servidor).
    const rawData = await validarEBuscaDados(req, 'menu', '*');

    // 2. Se o retorno for vazio, retornamos um array vazio para o frontend tratar
    if (!rawData || rawData.length === 0) {
      return res.status(200).json([]);
    }

    // 3. Tratamento dos dados (mapeamento para garantir compatibilidade de nomes de colunas)
    const menuTratado = rawData.map(item => ({
      ordem: item.ordem || item.Ordem || item.ORDEM,
      descricao: item.descricao || item.Descricao || item.Descrição,
      pagina: item.pagina || item.Pagina,
      icone: item.icone || 'bi-folder2'
    }));

    // 4. Ordenação inteligente (funciona para 1, 1.1, 2, 2.1...)
    menuTratado.sort((a, b) => 
      String(a.ordem).localeCompare(String(b.ordem), undefined, { numeric: true })
    );

    return res.status(200).json(menuTratado);

  } catch (error) {
    // Captura erros de "Não autorizado" (401) ou erros técnicos (500)
    const status = error.message.includes("autorizado") ? 401 : 500;
    console.error("Erro no menu.js:", error.message);
    
    return res.status(status).json({ 
      erro: error.message 
    });
  }
}
