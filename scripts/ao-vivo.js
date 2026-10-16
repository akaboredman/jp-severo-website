/* Aula ao vivo: o aluno abre o link (#t=<token>) e vê o mesmo deck do professor.
   Esta página só repassa mensagens entre o deck e o Supabase Realtime; a
   sincronização (slides, exercícios, marcações) fica dentro do deck.
   Gêmeo de RELAY_JS em Class Planner/planner/live_lesson.py: mudar os dois juntos. */
(() => {
  const KEY = 'ao-vivo-token';
  const store = {
    get() { try { return sessionStorage.getItem(KEY); } catch { return null; } },
    set(value) { try { sessionStorage.setItem(KEY, value); } catch { /* sem storage */ } },
  };
  const match = location.hash.match(/^#t=([A-Za-z0-9_-]{40,64})$/);
  if (match) {
    store.set(match[1]);
    history.replaceState(null, '', location.pathname);
  }
  const token = (match && match[1]) || store.get();

  function message(title, text) {
    document.getElementById('msgTitle').textContent = title;
    document.getElementById('msgText').textContent = text;
  }

  function relay(frame, cfg) {
    const sb = supabase.createClient(cfg.supabase_url, cfg.publishable_key,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const ch = sb.channel(`live:${cfg.channel}`, { config: { broadcast: { self: false },
      presence: { key: `${cfg.role}-${Math.random().toString(36).slice(2, 8)}` } } });
    const toDeck = (m) => frame.contentWindow && frame.contentWindow.postMessage({ cpLive: true, ...m }, '*');
    let connected = false;
    let ready = false;
    const status = () => ready && toDeck({ type: 'status', connected,
      peers: Object.values(ch.presenceState()).flat().map((p) => p.role) });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => ready && toDeck({ type: 'recv', msg: payload }));
    ch.on('presence', { event: 'sync' }, status);
    ch.subscribe(async (st) => {
      connected = st === 'SUBSCRIBED';
      if (connected) { try { await ch.track({ role: cfg.role }); } catch { /* tenta de novo ao reconectar */ } }
      status();
    });
    window.addEventListener('message', (e) => {
      if (e.source !== frame.contentWindow || !e.data || !e.data.cpLive) return;
      if (e.data.type === 'ready') { ready = true; toDeck({ type: 'init', role: cfg.role, names: cfg.names }); status(); }
      if (e.data.type === 'send' && connected) ch.send({ type: 'broadcast', event: 'm', payload: e.data.msg });
    });
  }

  async function start() {
    if (!token) { message('Link incompleto', 'Abra o link que o professor mandou no chat da aula.'); return; }
    let response;
    try {
      response = await fetch('/api/live', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    } catch {
      message('Sem conexão', 'Verifique a internet e recarregue a página.'); return;
    }
    if (response.status === 410) { message('Esta aula já terminou', 'Peça um link novo ao professor.'); return; }
    if (!response.ok) { message('Link inválido', 'Confira se copiou o link inteiro ou peça um novo ao professor.'); return; }
    const cfg = await response.json();
    if (cfg.title) document.title = `${cfg.title} | JP Severo`;
    const frame = document.getElementById('deck');
    relay(frame, cfg);
    frame.addEventListener('load', () => frame.focus());
    frame.srcdoc = cfg.html;
    document.body.classList.add('live');
  }
  start();
})();
