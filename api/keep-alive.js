// api/keep-alive.js
// Cron job — sem validação de sessão pois é chamado pelo Vercel, não pelo usuário.
import { SUPABASE_URL, sbHeaders } from './_seguranca.js';

export default async function handler(req, res) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?select=*`, {
      headers: { ...sbHeaders, 'Prefer': 'count=planned' }
    });
    if (response.ok) {
      return res.status(200).json({ sucesso: true, mensagem: "Supabase acordado com sucesso!", status: response.status });
    }
    const detalhe = await response.text();
    return res.status(response.status).json({ sucesso: false, erro: "O banco respondeu, mas recusou o acesso.", detalhe });
  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
