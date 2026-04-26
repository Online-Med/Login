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
  
      // pesquisa em 'codigo' OU em 'descricao'
  const { ok, data } = await sb(
    `cid?or=(codigo.ilike.*${termo}*,descricao.ilike.*${termo}*)&limit=10&select=codigo,descricao`
  );
  
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



// ---------- Gestão de Hospitais (frontend) ----------
// Insira este código no seu arquivo configuracoes.js
(function() {
  // Namespace para evitar colisões
  window.HOSP = window.HOSP || {};

  // Estado simples
  HOSP._lista = [];
  HOSP._modalInstance = null;

  // Carrega lista do servidor
  HOSP.carregarHospitais = function() {
    var tbody = document.getElementById('tabelaHospitais');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border spinner-border-sm text-info"></div> Carregando...</td></tr>';

    fetch('/api/hospitais')
      .then(function(r){ return r.json(); })
      .then(function(json){
        if (!json || !json.dados) { tbody.innerHTML = '<tr><td colspan="5" class="text-center p-3 text-danger">Erro ao carregar.</td></tr>'; return; }
        HOSP._lista = json.dados;
        HOSP._renderTabela();
      })
      .catch(function(err){
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-3 text-danger">Erro ao carregar.</td></tr>';
      });
  };

  HOSP._renderTabela = function() {
    var tbody = document.getElementById('tabelaHospitais');
    if (!tbody) return;
    if (!HOSP._lista.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Nenhum hospital cadastrado.</td></tr>'; return;
    }
    tbody.innerHTML = HOSP._lista.map(function(h){
      var telefones = h.telefones || '';
      var endereco = h.endereco || '';
      var anexosCount = Array.isArray(h.anexos) ? h.anexos.length : (h.anexos_count || 0);
      return '<tr>'
        +'<td class="ps-3 pe-1">'
          +'<div class="btn-group" role="group">'
            +'<button class="btn btn-sm btn-outline-primary" title="Editar" onclick="HOSP.editarHospital('+h.id+')"><i class="bi bi-pencil"></i></button>'
            +'<button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="HOSP.excluirHospital('+h.id+',\''+escapeHtml(h.nome||'')+'\')"><i class="bi bi-trash"></i></button>'
          +'</div>'
        +'</td>'
        +'<td class="align-middle">'+escapeHtml(h.nome||'')+'</td>'
        +'<td class="align-middle small text-muted">'+escapeHtml(telefones)+'</td>'
        +'<td class="align-middle small text-muted">'+escapeHtml(endereco)+'</td>'
        +'<td class="text-center align-middle">'+(anexosCount?('<span class="badge bg-secondary">'+anexosCount+'</span>'):'<small class="text-muted">0</small>')+'</td>'
      +'</tr>';
    }).join('');
  };

  // Novo hospital
  HOSP.novoHospital = function() {
    document.getElementById('h_id').value = '';
    document.getElementById('h_nome').value = '';
    document.getElementById('h_telefones').value = '';
    document.getElementById('h_endereco').value = '';
    document.getElementById('h_arquivos').value = '';
    document.getElementById('h_lista_anexos').innerHTML = '<small class="text-muted">Nenhum anexo</small>';
    document.getElementById('modalHospitalTitulo').textContent = 'Novo Hospital';
    showModal('modalHospital');
  };

  // Editar hospital
  HOSP.editarHospital = function(id) {
    // busca localmente, se não, faz GET
    var h = HOSP._lista.find(function(x){ return x.id == id; });
    if (h) {
      fillModalWith(h);
      showModal('modalHospital');
    } else {
      fetch('/api/hospitais?id='+id)
        .then(function(r){ return r.json(); })
        .then(function(j){ 
          var hosp = j && j.hospital ? j.hospital : (j && j.dados && j.dados[0] ? j.dados[0] : null);
          if (!hosp) { alert('Hospital não encontrado'); return; }
          fillModalWith(hosp);
          showModal('modalHospital');
        }).catch(function(e){ console.error(e); alert('Erro ao carregar hospital'); });
    }

    function fillModalWith(hosp) {
      document.getElementById('h_id').value = hosp.id || '';
      document.getElementById('h_nome').value = hosp.nome || '';
      document.getElementById('h_telefones').value = hosp.telefones || '';
      document.getElementById('h_endereco').value = hosp.endereco || '';
      // anexos: espera hosp.anexos = [{id,nome,url}]
      renderAnexos(hosp.anexos || []);
      document.getElementById('modalHospitalTitulo').textContent = 'Editar Hospital';
    }
  };

  // Salvar (create / update)
  HOSP.salvarHospital = function() {
    var id = document.getElementById('h_id').value;
    var nome = document.getElementById('h_nome').value.trim();
    if (!nome) { if (typeof Swal !== 'undefined') Swal.fire({icon:'warning',title:'Informe o nome'}); else alert('Informe o nome'); return; }
    var telefones = document.getElementById('h_telefones').value.trim();
    var endereco = document.getElementById('h_endereco').value.trim();

    var payload = { nome: nome, telefones: telefones, endereco: endereco };

    var btn = document.getElementById('h_btnSalvar');
    btn.disabled = true;

    var method = id ? 'PATCH' : 'POST';
    var url = '/api/hospitais' + (id ? ('?id='+encodeURIComponent(id)) : '');

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if (!res || !res.sucesso) throw new Error(res && res.erro ? res.erro : 'Erro ao salvar');
      var newId = id || res.id || (res.dados && res.dados[0] && res.dados[0].id);
      // se há arquivos selecionados, enviar anexos
      var filesInput = document.getElementById('h_arquivos');
      if (filesInput && filesInput.files && filesInput.files.length && newId) {
        uploadAnexos(newId, filesInput.files).then(function(anexos){
          // fechar modal, recarregar lista
          if (typeof Swal !== 'undefined') Swal.fire({icon:'success',title:'Salvo com anexos',timer:1200,showConfirmButton:false});
          hideModal('modalHospital'); HOSP.carregarHospitais(); btn.disabled=false;
        }).catch(function(e){
          console.error(e);
          if (typeof Swal !== 'undefined') Swal.fire({icon:'warning',title:'Salvo, mas erro no upload de anexos'});
          hideModal('modalHospital'); HOSP.carregarHospitais(); btn.disabled=false;
        });
      } else {
        if (typeof Swal !== 'undefined') Swal.fire({icon:'success',title:'Salvo',timer:900,showConfirmButton:false});
        hideModal('modalHospital');
        HOSP.carregarHospitais();
        btn.disabled=false;
      }
    })
    .catch(function(err){
      console.error(err);
      btn.disabled=false;
      if (typeof Swal !== 'undefined') Swal.fire({icon:'error',title:'Erro ao salvar',text:err.message}); else alert('Erro: '+err.message);
    });
  };

  // Excluir hospital
  HOSP.excluirHospital = function(id, nomeEscaped) {
    var nome = decodeURIComponent(nomeEscaped);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Excluir hospital?',
        html: 'Deseja excluir <strong>'+escapeHtml(nome)+'</strong>?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33'
      }).then(function(result){
        if (!result.isConfirmed) return;
        fetch('/api/hospitais?id='+id, { method: 'DELETE' })
          .then(function(r){ return r.json(); })
          .then(function(res){ if (res && res.sucesso) { Swal.fire({icon:'success',title:'Excluído',timer:900,showConfirmButton:false}); HOSP.carregarHospitais(); } else throw new Error('Não foi possível excluir'); })
          .catch(function(err){ Swal.fire({icon:'error',title:'Erro',text:err.message||err}); });
      });
    } else {
      if (!confirm('Excluir hospital "'+nome+'"?')) return;
      fetch('/api/hospitais?id='+id, { method: 'DELETE' }).then(function(){ HOSP.carregarHospitais(); });
    }
  };

  // Upload de anexos (multipart)
  function uploadAnexos(hospitalId, filesList) {
    return new Promise(function(resolve, reject){
      var fd = new FormData();
      for (var i=0;i<filesList.length;i++) fd.append('files[]', filesList[i]);
      var url = '/api/hospitais/attachments?hospital_id=' + encodeURIComponent(hospitalId);
      fetch(url, { method: 'POST', body: fd })
        .then(function(r){ return r.json(); })
        .then(function(res){ if (res && res.sucesso) resolve(res.anexos || []); else reject(new Error(res && res.erro ? res.erro : 'Erro upload')); })
        .catch(function(err){ reject(err); });
    });
  }

  // Renderiza lista de anexos no modal com ação de excluir
  function renderAnexos(anexos) {
    var cont = document.getElementById('h_lista_anexos');
    if (!cont) return;
    if (!anexos || !anexos.length) { cont.innerHTML = '<small class="text-muted">Nenhum anexo</small>'; return; }
    cont.innerHTML = anexos.map(function(a){
      var nome = a.nome || a.filename || a.url && a.url.split('/').pop() || 'arquivo';
      var url = a.url || '#';
      return '<div class="d-flex align-items-center justify-content-between mb-1">'
        +'<div class="small"><a href="'+escapeHtml(url)+'" target="_blank">'+escapeHtml(nome)+'</a></div>'
        +'<div><button class="btn btn-sm btn-outline-danger" onclick="HOSP.excluirAnexo('+a.id+')"><i class="bi bi-x"></i></button></div>'
      +'</div>';
    }).join('');
  }

  // Excluir anexo
  HOSP.excluirAnexo = function(attachId) {
    if (!attachId) return;
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Excluir anexo?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Excluir'
      }).then(function(r){
        if (!r.isConfirmed) return;
        fetch('/api/hospitais/attachments?id='+attachId, { method: 'DELETE' })
          .then(function(rr){ return rr.json(); })
          .then(function(res){ if (res && res.sucesso) { Swal.fire({icon:'success',title:'Anexo excluído',timer:800,showConfirmButton:false}); HOSP.carregarHospitais(); } else throw new Error('Erro'); })
          .catch(function(e){ Swal.fire({icon:'error',title:'Erro',text:e.message||e}); });
      });
    } else {
      if (!confirm('Excluir anexo?')) return;
      fetch('/api/hospitais/attachments?id='+attachId, { method: 'DELETE' }).then(function(){ HOSP.carregarHospitais(); });
    }
  };

  // Modal helpers (usa Bootstrap 5)
  function showModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var m = bootstrap.Modal.getOrCreateInstance(el);
    m.show();
  }
  function hideModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var m = bootstrap.Modal.getInstance(el);
    if (m) m.hide();
  }

  // Escape HTML utility
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Inicializa carga
  document.addEventListener('DOMContentLoaded', function() {
    // carregamento inicial quando a página é aberta
    setTimeout(function(){ HOSP.carregarHospitais(); }, 80);
  });

})();
