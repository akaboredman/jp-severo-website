/* Prática: o aluno abre o link pessoal (#t=<token>), vê os decks e pratica.
   O token sai da barra de endereço na hora e fica só neste navegador. */
import { gradeItem } from './practice-grading.js';

const TOKEN_KEY = 'pratica.token';
const PREVIEW_KEY = 'pratica.preview';
const BLOCKS = { vocabulary: 'Vocabulário', grammar: 'Gramática', from_class: 'Da nossa aula' };
const KINDS = {
  card: 'Flashcard', gap_fill: 'Complete', match: 'Ligue', multiple_choice: 'Escolha',
  reorder: 'Monte a frase', error_correction: 'Corrija', type_in: 'Escreva',
};

// Instruções no estilo do C1 Advanced (Reading and Use of English, Parts 1-4).
const TASKS = {
  lexical_cloze: 'Choose the word that best fits the gap.',
  open_cloze: 'Write ONE word that best fits the gap.',
  word_formation: 'Use the word in capitals to form a word that fits the gap.',
  key_word_transformation: 'Complete the second sentence so that it has a similar meaning to the first. '
    + 'Use the word given and do not change it. Use between three and six words.',
};

const view = document.getElementById('view');
const main = document.getElementById('conteudo-principal');

/* ---------- Armazenamento local (pode falhar em aba anônima) ---------- */
const local = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem storage */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* sem storage */ } },
};

/* ---------- DOM seguro: todo texto entra via textContent ---------- */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}
function show(...nodes) {
  view.replaceChildren(...nodes.filter((node) => node != null && node !== false));
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const niceDate = (iso) => new Date(`${iso}T12:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

/* ---------- Token e API ---------- */
function readToken() {
  const match = location.hash.match(/^#t=([A-Za-z0-9_-]{40,64})$/);
  if (match) {
    local.set(TOKEN_KEY, match[1]);
    history.replaceState(null, '', location.pathname);
    return match[1];
  }
  return local.get(TOKEN_KEY);
}

class InvalidLink extends Error {}

async function api(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${state.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) throw new InvalidLink();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'server_error'), { data });
  return data;
}

const state = { token: null, session: null, preview: false };

function showInvalid() {
  local.remove(TOKEN_KEY);
  show(
    h('h1', {}, 'Link inválido ou desativado'),
    h('p', { class: 'pratica__lead' }, 'Peça ao JP um link novo pelo WhatsApp. Cada aluno tem um link pessoal.'),
  );
}
function showError(retry) {
  show(
    h('h1', {}, 'Não consegui carregar'),
    h('p', { class: 'pratica__lead' }, 'Verifique sua internet e tente de novo.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn btn--primary', onclick: retry }, 'Tentar de novo')),
  );
}
async function guarded(fn, retry) {
  try { await fn(); } catch (error) {
    if (error instanceof InvalidLink) showInvalid();
    else { console.error(error); showError(retry); }
  }
}

/* ---------- Início ---------- */
async function renderHome() {
  await guarded(async () => {
    const [session, decks, progress] = await Promise.all([
      state.session ? Promise.resolve(state.session) : api('/api/session'),
      api('/api/decks'),
      api('/api/progress').catch(() => null),
    ]);
    state.session = session;
    const bonus = session.bonuses?.available
      ? h('p', { class: 'pratica__notice' },
        session.bonuses.available === 1
          ? 'Você ganhou 1 aula bônus por indicação. Obrigado!'
          : `Você tem ${session.bonuses.available} aulas bônus por indicação. Obrigado!`)
      : null;
    const rows = decks.length
      ? decks.map((deck) => h('button', { class: 'deck-row', onclick: () => renderDeck(deck.id) },
        h('span', { class: 'deck-row__title' }, `Aula ${deck.lessonNumber} · ${deck.title || ''}`),
        h('span', { class: 'deck-row__meta' }, niceDate(deck.lessonDate)),
        h('span', { class: `deck-row__state deck-row__state--${deck.done ? 'done' : 'new'}` },
          deck.done ? `Feito · ${deck.best.correct}/${deck.best.total}` : 'Novo')))
      : [h('p', { class: 'deck-list__empty' }, 'Seu primeiro deck aparece aqui depois da próxima aula.')];
    show(
      h('h1', {}, `Olá, ${session.firstName}!`),
      h('p', { class: 'pratica__lead' }, 'Aqui ficam os exercícios de cada aula. Leva uns 10 minutos.'),
      progress ? progressStrip(progress) : null,
      bonus,
      h('div', { class: 'deck-list', role: 'list' }, rows),
    );
  }, renderHome);
}

/* ---------- Deck ---------- */
function steps(deck) {
  return (deck.blocks || []).flatMap((block) =>
    (block.items || []).map((item) => ({ block: block.kind, item })));
}
const progressKey = (run) => `pratica.progress.${run.deckId}.${run.version}`;

async function renderDeck(deckId) {
  await guarded(async () => {
    const data = await api(`/api/deck?id=${encodeURIComponent(deckId)}`);
    const saved = local.get(`pratica.progress.${data.id}.${data.version}`);
    const run = { deckId: data.id, version: data.version, deck: data.deck,
      steps: steps(data.deck), index: 0, answers: saved?.answers || {} };
    for (const id of saved?.requeued || []) {
      const step = run.steps.find((s) => s.item.id === id);
      if (step) insertRequeue(run, step.item);
    }
    run.index = Math.min(saved?.index || 0, run.steps.length);
    startRun(run);
  }, () => renderDeck(deckId));
}

function startRun(run) {
  state.run = run;
  renderStep();
}

function saveProgress() {
  if (!state.preview) {
    local.set(progressKey(state.run), { index: state.run.index, answers: state.run.answers,
      requeued: [...(state.run.requeued || [])] });
  }
}

function renderStep() {
  const run = state.run;
  if (run.index >= run.steps.length) return finish();
  const { block, item } = run.steps[run.index];
  const top = h('div', { class: 'runner__top' },
    h('button', { class: 'runner__back', onclick: state.preview ? () => window.close() : renderHome }, '← Voltar'),
    h('span', { class: 'runner__block' }, `${BLOCKS[block] || ''} · ${run.index + 1}/${run.steps.length}`));
  const bar = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0,
    'aria-valuemax': run.steps.length, 'aria-valuenow': run.index },
  h('div', { class: 'progress__bar', style: `width:${(run.index / run.steps.length) * 100}%` }));
  const body = h('div', { class: 'item' }, h('p', { class: 'item__kind' }, KINDS[item.type] || ''),
    TASKS[item.task] ? h('p', { class: 'item__instruction', lang: 'en' }, TASKS[item.task]) : null);
  const actions = h('div', { class: 'actions' });
  const next = () => { run.index += 1; saveProgress(); renderStep(); };
  const answered = Object.hasOwn(run.answers, item.id);

  if (item.type === 'card') {
    renderCard(item, body, actions, next);
  } else if (item.type === 'type_in') {
    renderTypeIn(item, body, actions, next, answered);
  } else if (['multiple_choice', 'gap_fill', 'error_correction'].includes(item.type)) {
    renderChoice(item, body, actions, next, answered);
  } else if (item.type === 'match') {
    renderMatch(item, body, actions, next, answered);
  } else if (item.type === 'reorder') {
    renderReorder(item, body, actions, next, answered);
  }
  show(top, bar, body, actions);
}

// Flashcard: tenta lembrar, vira, e marca. "Não lembrei" traz o cartão de volta
// uma vez no fim do bloco de vocabulário. Cartões não entram na nota.
function renderCard(item, body, actions, next) {
  const front = item.front ?? item.word;
  const answer = item.answer ?? item.word;
  body.append(h('p', { class: 'card-front', lang: 'en' }, String(front).replace('___', '_____')));
  const back = h('div', { class: 'card-back', hidden: true },
    answer && answer !== front ? h('p', { class: 'card-word', lang: 'en' }, answer) : null,
    item.meaning ? h('p', { class: 'card-meaning', lang: 'en' }, item.meaning) : null,
    item.translation ? h('p', { class: 'card-translation' }, h('span', { class: 'card-tag' }, 'PT'), ' ', item.translation) : null,
    item.example ? h('p', { class: 'card-example', lang: 'en' }, item.example) : null);
  body.append(back);
  const reveal = h('button', { class: 'btn btn--primary', onclick: () => {
    back.hidden = false;
    const again = h('button', { class: 'btn btn--ghost', onclick: () => { requeue(item); next(); } }, 'Não lembrei');
    const known = h('button', { class: 'btn btn--primary', onclick: next }, 'Lembrei');
    actions.replaceChildren(known, again);
    known.focus();
  } }, 'Mostrar resposta');
  actions.append(reveal);
}

function requeue(item) {
  insertRequeue(state.run, item);
  saveProgress();
}

// Coloca o cartão de novo depois do último passo do bloco de vocabulário (uma vez só).
function insertRequeue(run, item) {
  run.requeued = run.requeued || new Set();
  if (run.requeued.has(item.id)) return;
  run.requeued.add(item.id);
  const last = run.steps.map((s) => s.block).lastIndexOf('vocabulary');
  run.steps.splice(last + 1, 0, { block: 'vocabulary', item });
}

function renderTypeIn(item, body, actions, next, answered) {
  if (item.context) body.append(h('p', { class: 'item__context', lang: 'en' }, item.context));
  if (item.hint) body.append(h('p', { class: 'item__hint' }, item.hint));
  body.append(h('p', { class: 'item__prompt', lang: 'en' }, item.prompt.replace('___', '_____')));
  const input = h('input', { class: 'type-in', type: 'text', lang: 'en', autocomplete: 'off',
    autocapitalize: 'off', spellcheck: 'false', maxlength: '200', 'aria-label': 'Sua resposta' });
  body.append(input);
  const check = h('button', { class: 'btn btn--primary', disabled: true, onclick: submit }, 'Verificar');
  actions.append(check);
  input.addEventListener('input', () => { check.disabled = !input.value.trim(); });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && input.value.trim()) submit(); });
  function submit() {
    state.run.answers[item.id] = input.value.trim();
    saveProgress();
    reveal(state.run.answers[item.id]);
  }
  function reveal(answer) {
    input.value = answer;
    input.disabled = true;
    const right = gradeItem(item, answer);
    input.classList.add(right ? 'is-right' : 'is-wrong');
    body.append(feedback(item, right, right ? null : `${item.accepted.join(' / ')}.`));
    continueButton(actions, next);
  }
  if (answered) reveal(state.run.answers[item.id]); else setTimeout(() => input.focus(), 0);
}

function feedback(item, right, extra) {
  return h('div', { class: `feedback feedback--${right ? 'right' : 'wrong'}`, role: 'status' },
    h('b', {}, right ? 'Isso!' : 'Quase.'), ' ', extra ? h('span', { lang: 'en' }, extra, ' ') : null,
    h('span', { lang: 'en' }, item.explanation || ''));
}
function continueButton(actions, next) {
  const button = h('button', { class: 'btn btn--primary', onclick: next }, 'Continuar');
  actions.replaceChildren(button);
  button.focus();
}

function renderChoice(item, body, actions, next, answered) {
  if (item.type === 'error_correction') {
    body.append(h('p', { class: 'item__prompt' }, 'Na aula, você disse:'),
      h('p', { class: 'item__said', lang: 'en' }, `“${item.original}”`),
      h('p', { class: 'pratica__lead' }, 'Qual é a forma correta?'));
  } else {
    body.append(h('p', { class: 'item__prompt', lang: 'en' }, item.prompt.replace('___', '_____')));
  }
  const buttons = item.options.map((option, index) =>
    h('button', { class: 'choice', lang: 'en', onclick: () => choose(index) }, option));
  body.append(h('div', { class: 'choices' }, buttons));
  function choose(index) {
    state.run.answers[item.id] = index;
    saveProgress();
    reveal(index);
  }
  function reveal(index) {
    buttons.forEach((button, i) => {
      button.disabled = true;
      if (i === item.answer) button.classList.add('is-right');
      else if (i === index) button.classList.add('is-wrong');
    });
    body.append(feedback(item, gradeItem(item, index)));
    continueButton(actions, next);
  }
  if (answered) reveal(state.run.answers[item.id]);
}

function renderMatch(item, body, actions, next, answered) {
  body.append(h('p', { class: 'item__prompt' }, 'Ligue cada palavra ao significado.'));
  const pairs = {};
  let picked = null;
  const lefts = item.pairs.map((pair) => h('button', { class: 'match__btn', lang: 'en', onclick: () => pickLeft(pair.left) }, pair.left));
  const rights = shuffle(item.pairs.map((pair) => pair.right)).map((right) =>
    h('button', { class: 'match__btn', lang: 'en', onclick: () => pickRight(right) }, right));
  const leftOf = (text) => lefts.find((b) => b.textContent === text);
  const rightOf = (text) => rights.find((b) => b.textContent === text);
  body.append(h('div', { class: 'match' }, h('div', { class: 'match__col' }, lefts), h('div', { class: 'match__col' }, rights)));
  const check = h('button', { class: 'btn btn--primary', disabled: true, onclick: submit }, 'Verificar');
  const reset = h('button', { class: 'btn btn--ghost', onclick: clear }, 'Recomeçar');
  actions.append(check, reset);

  function refresh() {
    const pairedRights = new Set(Object.values(pairs));
    lefts.forEach((b) => { b.classList.toggle('is-paired', b.textContent in pairs); b.classList.toggle('is-picked', b.textContent === picked); });
    rights.forEach((b) => b.classList.toggle('is-paired', pairedRights.has(b.textContent)));
    check.disabled = Object.keys(pairs).length !== item.pairs.length;
  }
  function pickLeft(text) { if (!(text in pairs)) { picked = text; refresh(); } }
  function pickRight(text) {
    if (!picked || Object.values(pairs).includes(text)) return;
    pairs[picked] = text;
    picked = null;
    refresh();
  }
  function clear() { for (const key of Object.keys(pairs)) delete pairs[key]; picked = null; refresh(); }
  function submit() {
    state.run.answers[item.id] = { ...pairs };
    saveProgress();
    reveal(pairs);
  }
  function reveal(answer) {
    [...lefts, ...rights].forEach((b) => { b.disabled = true; b.classList.remove('is-paired', 'is-picked'); });
    for (const pair of item.pairs) {
      const ok = answer[pair.left] === pair.right;
      leftOf(pair.left).classList.add(ok ? 'is-right' : 'is-wrong');
      if (ok) rightOf(pair.right).classList.add('is-right');
    }
    const wrong = item.pairs.filter((pair) => answer[pair.left] !== pair.right);
    body.append(feedback(item, wrong.length === 0,
      wrong.length ? wrong.map((pair) => `${pair.left} = ${pair.right}.`).join(' ') : null));
    continueButton(actions, next);
  }
  if (answered) reveal(state.run.answers[item.id]);
}

function renderReorder(item, body, actions, next, answered) {
  body.append(h('p', { class: 'item__prompt' }, 'Monte a frase na ordem certa.'));
  const tokens = item.tokens.map((text, i) => ({ text, key: i }));
  let bank = shuffle(tokens);
  if (bank.every((token, i) => token.key === i)) bank.reverse();
  let chosen = [];
  const answerBox = h('div', { class: 'order-answer', lang: 'en', 'aria-label': 'Sua frase' });
  const bankBox = h('div', { class: 'order-bank', lang: 'en' });
  body.append(answerBox, bankBox);
  const check = h('button', { class: 'btn btn--primary', disabled: true, onclick: submit }, 'Verificar');
  actions.append(check);

  function draw(locked = false) {
    answerBox.replaceChildren(...chosen.map((token) => h('button', { class: 'chip', disabled: locked,
      onclick: () => { chosen = chosen.filter((t) => t !== token); bank.push(token); draw(); } }, token.text)));
    bankBox.replaceChildren(...bank.map((token) => h('button', { class: 'chip', disabled: locked,
      onclick: () => { bank = bank.filter((t) => t !== token); chosen.push(token); draw(); } }, token.text)));
    check.disabled = bank.length > 0;
  }
  function submit() {
    state.run.answers[item.id] = chosen.map((token) => token.text);
    saveProgress();
    reveal(state.run.answers[item.id]);
  }
  function reveal(answer) {
    chosen = answer.map((text, i) => ({ text, key: `a${i}` }));
    bank = [];
    draw(true);
    const right = gradeItem(item, answer);
    answerBox.classList.add(right ? 'is-right' : 'is-wrong');
    body.append(feedback(item, right, right ? null : `${item.tokens.join(' ')}.`));
    continueButton(actions, next);
  }
  if (answered) reveal(state.run.answers[item.id]); else draw();
}

/* ---------- Final ---------- */
async function finish() {
  const run = state.run;
  if (state.preview) {
    const total = run.steps.filter((s) => s.item.type !== 'card').length;
    const correct = run.steps.filter((s) => s.item.type !== 'card' && gradeItem(s.item, run.answers[s.item.id])).length;
    return showResult({ correct, total, completedDecks: 3,
      progress: { streakWeeks: 3, practicedThisWeek: true, weekGoal: { done: 1, total: 2 }, communityThisWeek: 24 } },
      { referralCode: 'preview', firstName: 'Aluno' });
  }
  show(h('p', { class: 'pratica__status' }, 'Salvando seu resultado…'));
  await guarded(async () => {
    const result = await api('/api/complete', { deckId: run.deckId, answers: run.answers });
    local.remove(progressKey(run));
    showResult(result, state.session || await api('/api/session'));
  }, finish);
}

function showResult(result, session) {
  const nodes = [
    h('h1', {}, 'Deck concluído!'),
    h('p', { class: 'result__score' }, `${result.correct}/${result.total}`),
    result.progress ? progressStrip(result.progress, true) : null,
  ];
  const referral = referralSection(session, result.completedDecks);
  if (referral) nodes.push(referral);
  nodes.push(h('div', { class: 'actions' },
    h('button', { class: 'btn btn--primary', onclick: state.preview ? () => window.close() : renderHome }, 'Voltar aos decks')));
  show(...nodes);
}

// Progresso pessoal, sem comparar alunos: semanas seguidas, meta da semana e
// quantos decks todos os alunos fizeram na semana (sem nomes).
const COMMUNITY_MIN = 3;
function progressStrip(progress, afterDeck = false) {
  const items = [];
  const weeks = progress.streakWeeks || 0;
  if (weeks >= 1) {
    items.push(h('li', { class: 'progress-strip__item' },
      h('b', {}, weeks === 1 ? '1 semana' : `${weeks} semanas`), ' seguidas praticando',
      progress.practicedThisWeek ? '' : '. Faça um deck esta semana para manter.'));
  } else if (!afterDeck) {
    items.push(h('li', { class: 'progress-strip__item' }, 'Faça um deck esta semana e comece sua sequência.'));
  }
  const goal = progress.weekGoal || { done: 0, total: 0 };
  if (goal.total > 0) {
    items.push(h('li', { class: 'progress-strip__item' }, 'Meta da semana: ',
      h('b', {}, `${goal.done} de ${goal.total}`), goal.total === 1 ? ' deck' : ' decks',
      goal.done >= goal.total ? '. Meta cumprida!' : ''));
  }
  if ((progress.communityThisWeek || 0) >= COMMUNITY_MIN) {
    items.push(h('li', { class: 'progress-strip__item progress-strip__item--muted' },
      `Esta semana os alunos do JP fizeram ${progress.communityThisWeek} decks.`));
  }
  return items.length ? h('ul', { class: 'progress-strip', 'aria-label': 'Seu progresso' }, items) : null;
}

// Discreto em todo deck; em destaque no 3º concluído e depois a cada 5. Nunca para menores.
function referralSection(session, completedDecks) {
  if (!session?.referralCode) return null;
  const prominent = completedDecks === 3 || (completedDecks > 3 && (completedDecks - 3) % 5 === 0);
  const link = `https://jpsevero.com.br/aula?ref=${encodeURIComponent(session.referralCode)}`;
  const message = `Oi! Estou fazendo aulas de inglês com o JP Severo e estou gostando muito. Se quiser conhecer, dá para agendar uma aula experimental aqui: ${link}`;
  const text = 'Se você estiver gostando das aulas e das atividades, por favor considere enviar meu contato para alguém que gostaria de aprender inglês.';
  return h('section', { class: 'result__section' },
    prominent ? h('h2', {}, 'Conhece alguém que quer aprender inglês?') : null,
    h('p', { class: 'pratica__lead' }, text),
    prominent ? h('p', { class: 'pratica__lead' }, 'Se a pessoa fechar as aulas, você ganha 1 aula bônus.') : null,
    h('div', { class: 'actions' }, h('a', {
      class: prominent ? 'btn btn--primary' : 'btn btn--ghost',
      href: `https://wa.me/?text=${encodeURIComponent(message)}`, target: '_blank', rel: 'noopener noreferrer',
    }, 'Indicar pelo WhatsApp')));
}

/* ---------- Início da página ---------- */
// Um link novo aberto na mesma aba só muda o #: recarrega para trocar de aluno.
window.addEventListener('hashchange', () => {
  if (/^#(t=|preview$)/.test(location.hash)) location.reload();
});

if (location.hash === '#preview') {
  // Mesa de aulas: "Ver como o aluno" (sem rede, sem salvar nada).
  state.preview = true;
  const deck = local.get(PREVIEW_KEY);
  if (deck) startRun({ deckId: 'preview', version: 0, deck, steps: steps(deck), index: 0, answers: {} });
  else show(h('p', { class: 'pratica__status' }, 'Nada para pré-visualizar.'));
} else {
  state.token = readToken();
  if (!state.token) showInvalid();
  else renderHome();
}

