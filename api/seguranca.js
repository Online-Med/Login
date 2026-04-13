// api/_seguranca.js
export const SUPABASE_URL = "https://pijymmyhtjvgfnpazjww.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpanltbXlodGp2Z2ZucGF6and3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIwMDgxMCwiZXhwIjoyMDg5Nzc2ODEwfQ.VA6bhNcYV2y95tuUZh8W94jCy4d8bh-bDFXcLYI2LVM"; // Sua chave mestra

export async function validarEBuscaDados(req, tabela, query = "*") {
  const userEmail = req.headers['x-user-email'];
  if (!userEmail) throw new Error("Não autorizado: E-mail não fornecido");

  const checkUrl = `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${userEmail}&select=id_profissional`;
  const checkRes = await fetch(checkUrl, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const usuarioValido = await checkRes.json();

  if (!usuarioValido || usuarioValido.length === 0) throw new Error("Acesso Negado");

  const dataUrl = `${SUPABASE_URL}/rest/v1/${tabela}?select=${query}`;
  const response = await fetch(dataUrl, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  return await response.json();
}
