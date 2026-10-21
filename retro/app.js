const panel = document.querySelector('#demo-panel');
const status = document.querySelector('#demo-status');
const tabs = [...document.querySelectorAll('[role="tab"]')];
const inboxMarkup = panel.innerHTML;
const thoughts = [];
let completed = false;

function addThought(text) {
  const row = document.createElement('li');
  const icon = document.createElement('span');
  icon.className = 'thought-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '✧';
  const content = document.createElement('span');
  content.textContent = text;
  const tag = document.createElement('span');
  tag.className = 'item-tag';
  tag.textContent = 'thought';
  row.append(icon, content, tag);
  document.querySelector('#thought-list').prepend(row);
}

function bindInbox() {
  thoughts.forEach(addThought);
  document.querySelector('#capture-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.querySelector('#new-thought');
    const text = input.value.trim();
    if (!text) { input.value = ''; input.focus(); return; }
    if (thoughts.length >= 20) { status.textContent = 'Demo inbox full! Start your own space in EdgeFocus.'; return; }
    thoughts.push(text);
    addThought(text);
    input.value = '';
    input.focus();
    status.textContent = `${thoughts.length + 3} things out of your head. A little more breathing room.`;
  });
}

function showView(view, focus = false) {
  tabs.forEach((tab) => {
    const selected = tab.dataset.view === view;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  panel.setAttribute('aria-labelledby', `tab-${view}`);
  if (view === 'inbox') {
    panel.innerHTML = inboxMarkup;
    bindInbox();
    status.textContent = `${thoughts.length + 3} things out of your head. That's a start.`;
  } else if (view === 'projects') {
    panel.innerHTML = `<div class="demo-intro"><h3>Give your next big thing a next small step.</h3><p>A sample project board. Check off the task to try it.</p></div><div class="project-board"><section class="board-lane"><h4>To do</h4><div class="board-task">Collect the wild ideas<small>Creative project</small></div></section><section class="board-lane"><h4>In progress</h4><div class="board-task"><label><input type="checkbox" id="demo-task" ${completed ? 'checked' : ''}><span>Make a little room to focus</span></label><small>You · Today</small></div></section><section class="board-lane"><h4>Done</h4><div class="board-task">Find a place to start <span aria-hidden="true">✓</span><small>Small wins count.</small></div></section></div>`;
    const task = document.querySelector('#demo-task');
    const moveTask = () => {
      const restoreFocus = document.activeElement === task;
      const card = task.closest('.board-task');
      const lanes = panel.querySelectorAll('.board-lane');
      lanes[completed ? 2 : 1].append(card);
      if (restoreFocus) task.focus({preventScroll: true});
      status.textContent = completed ? 'One small thing, done. Enjoy that feeling.' : 'Pick one thing. Give it your attention.';
    };
    task.addEventListener('change', () => { completed = task.checked; moveTask(); });
    moveTask();
  } else {
    panel.innerHTML = `<div class="demo-intro"><h3>A little help making sense of it all.</h3><p>Meet the AI assistants inside EdgeFocus.</p></div><div class="ai-demo"><span class="bot-avatar falco" aria-hidden="true">⌐■_■</span><div><strong>Falco · Inbox organizer</strong><p>Helps organize the ideas, notes and tasks coming into your inbox.</p></div></div><div class="ai-demo"><span class="bot-avatar eva" aria-hidden="true">◕‿◕</span><div><strong>EVA · Your conversational sidekick</strong><p>Ask questions about your tasks and projects, with your work as context.</p></div></div>`;
    status.textContent = 'Meet them in EdgeFocus. This preview does not run AI.';
  }
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => showView(tab.dataset.view));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    showView(tabs[next].dataset.view, true);
  });
});
document.querySelector('#meet-sidekicks').addEventListener('click', () => showView('ai'));
bindInbox();

// A tiny original arpeggio; audio starts only after an explicit click.
const soundToggle = document.querySelector('#sound-toggle');
let audioContext;
let soundOn = false;
let melodyTimer;
let soundBusy = false;
function playMelody() {
  const notes = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66];
  notes.forEach((frequency, i) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const time = audioContext.currentTime + i * 0.28;
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.035, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.23);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.25);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
async function stopSound() {
  clearInterval(melodyTimer);
  soundOn = false;
  const oldContext = audioContext;
  audioContext = null;
  soundToggle.innerHTML = '<span aria-hidden="true">♫</span> Sound: off';
  soundToggle.setAttribute('aria-pressed', 'false');
  if (oldContext && oldContext.state !== 'closed') await oldContext.close();
}
soundToggle.addEventListener('click', async () => {
  if (soundBusy) return;
  soundBusy = true;
  try {
    if (soundOn) { await stopSound(); return; }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { soundToggle.textContent = 'Sound unavailable'; soundToggle.disabled = true; return; }
    audioContext = new Audio();
    await audioContext.resume();
    soundOn = true;
    soundToggle.innerHTML = '<span aria-hidden="true">♫</span> Sound: on';
    soundToggle.setAttribute('aria-pressed', 'true');
    playMelody();
    melodyTimer = setInterval(playMelody, 4500);
  } catch { await stopSound(); document.querySelector('#browser-status').textContent = 'Sound unavailable in this browser. Enjoy the quiet.'; }
  finally { soundBusy = false; }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && soundOn) stopSound(); });
window.addEventListener('pagehide', () => { if (soundOn) stopSound(); });

document.querySelectorAll('[data-demo-link]').forEach(link => {
  link.addEventListener('click', () => showView(link.dataset.demoLink));
});

const guestForm = document.querySelector('#guestbook-form');
const guestInput = document.querySelector('#guest-note');
const guestStatus = document.querySelector('#guestbook-status');
const guestKey = 'edgefocus-cyberspace-guest-note';
try {
  const previousNote = localStorage.getItem(guestKey);
  if (previousNote) guestStatus.textContent = `Your note: “${previousNote.slice(0, 120)}”`;
} catch { /* The form also works when browser storage is unavailable. */ }
guestForm.addEventListener('submit', event => {
  event.preventDefault();
  const note = guestInput.value.trim();
  if (!note) { guestInput.value = ''; guestInput.focus(); return; }
  try {
    localStorage.setItem(guestKey, note);
    guestStatus.textContent = `Saved here: “${note}”`;
  } catch {
    guestStatus.textContent = `Your note: “${note}” (this browser could not save it)`;
  }
  guestInput.value = '';
});
