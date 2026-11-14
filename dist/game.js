import {
  CELL,
  SAVE_KEY,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  createGrid,
  canStand,
  visible,
  findPath,
  freshState,
  stage,
  objectives,
  noteData,
  parseSave,
} from './core.js';
import { makeWorld } from './world.js';
import { Sound } from './audio.js';
import { bindTouch } from './touch.js';
import {
  levels,
  tasksFor,
  floorReady,
  campaignObjective,
  completeTask,
  nextFloor,
  levelCode,
  dailySeed,
  readRecords,
  RECORDS_KEY,
} from './campaign.js';

const $ = (id) => document.getElementById(id);
let grid = createGrid();
const settings = { ...DEFAULT_SETTINGS };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
} catch {}
for (const name of ['volume', 'brightness', 'sensitivity', 'controlScale']) {
  if (!Number.isFinite(Number(settings[name]))) settings[name] = DEFAULT_SETTINGS[name];
  settings[name] = Math.max(
    Number($(name).min),
    Math.min(Number($(name).max), Number(settings[name])),
  );
}
if (!['low', 'medium', 'high'].includes(settings.quality)) settings.quality = 'medium';
if (!['story', 'normal', 'hard'].includes(settings.difficulty)) settings.difficulty = 'normal';
settings.motion = settings.motion !== false;
const sound = new Sound();
sound.setVolume(settings.volume / 100);
const touch =
  matchMedia('(pointer:coarse)').matches ||
  navigator.maxTouchPoints > 0 ||
  new URLSearchParams(location.search).get('controls') === 'touch';
document.body.classList.toggle('touch', touch);
try {
  if (touch && !localStorage.getItem(SETTINGS_KEY)) {
    settings.quality = 'low';
    settings.motion = false;
  }
} catch {}
settings.tapInteract = settings.tapInteract !== false;
settings.autoRun = settings.autoRun !== false;
let world;
try {
  world = makeWorld($('scene'), grid, settings);
} catch (error) {
  $('loading').textContent =
    'Не удалось запустить 3D. Открой игру в Safari или Chrome с включённым WebGL и перезагрузи страницу.';
  console.error(error);
  throw error;
}
let state = freshState(),
  saved = null,
  mode = 'menu',
  flashlight = true,
  target = null;
let lastTime = performance.now(),
  clock = 0,
  saveClock = 0,
  stepClock = 0,
  subtitleUntil = 0,
  toastUntil = 0;
let enemy = {
  x: 23.5 * CELL,
  z: 8.5 * CELL,
  path: [],
  pathTimer: 0,
  patrol: 0,
  alert: 0,
  grace: 12,
  lastSeen: null,
  step: 0,
};
const patrol = [
  { x: 23.5 * CELL, z: 8.5 * CELL },
  { x: 15.5 * CELL, z: 9.5 * CELL },
  { x: 8.5 * CELL, z: 8.5 * CELL },
  { x: 18.5 * CELL, z: 9.5 * CELL },
];
const input = { keys: new Set(), moveX: 0, moveZ: 0, run: false, look: null, stick: null };
let touchController = null;
let codeContext = 'exit';
let finalWon = false;
let records;
try {
  records = readRecords(localStorage.getItem(RECORDS_KEY));
} catch {
  records = readRecords(null);
}
let previousPanel = 'pausePanel',
  codeInput = '',
  caughtUntil = 0;

function readSave() {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY), grid);
  } catch {
    return null;
  }
}
function save() {
  if (!state.started) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    saved = { ...state };
  } catch {
    toast('Сохранение недоступно в этом браузере.');
  }
}
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  toastUntil = clock + 4;
}
function subtitle(text, duration = 5) {
  $('subtitle').textContent = text;
  subtitleUntil = clock + duration;
}
function clearInput() {
  touchController?.reset();
  input.keys.clear();
  input.moveX = 0;
  input.moveZ = 0;
  input.run = false;
  $('touchRun').classList.remove('active');
  input.look = null;
  input.stick = null;
  $('stick').style.transform = '';
}
function leavePointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}
function lockPointer() {
  if (!touch && $('scene').requestPointerLock) {
    try {
      $('scene')
        .requestPointerLock()
        ?.catch?.(() => {});
    } catch {}
  }
}
function showPanel(id) {
  mode = 'paused';
  clearInput();
  leavePointer();
  sound.setActive(false);
  $('overlay').hidden = false;
  for (const panel of $('overlay').children) panel.hidden = panel.id !== id;
}
function back() {
  if (state.started && mode !== 'menu') resume();
  else {
    $('overlay').hidden = true;
    mode = 'menu';
  }
}
function resume() {
  if (!state.started) return;
  $('overlay').hidden = true;
  mode = 'playing';
  clearInput();
  sound.start();
  lockPointer();
}
function pause() {
  if (mode !== 'playing') return;
  save();
  showPanel('pausePanel');
}
function updateObjective() {
  const level = levels[state.level];
  const current = state.level === 0 ? objectives[stage(state)] : ['', campaignObjective(state)];
  $('chapterLabel').textContent = 'ЭТАЖ ' + level.floor + ' / ' + level.title.toUpperCase();
  $('objective').textContent = current[1];
  $('floorBadge').textContent = state.level + 1 + ' / ' + levels.length;
  if (state.level === 0) {
    for (const [id, found] of [
      ['fuseSlot', state.fuse],
      ['keySlot', state.key],
      ['codeSlot', state.code],
    ])
      $(id).classList.toggle('found', found);
    $('fuseSlot').textContent = 'ПРЕДОХРАНИТЕЛЬ';
    $('keySlot').textContent = 'КЛЮЧ 13';
    $('codeSlot').textContent = 'КОД ВЫХОДА';
  } else {
    const required = tasksFor(state).filter((task) => !task.optional);
    $('fuseSlot').textContent =
      'ЗАДАЧИ ' +
      required.filter((task) => state.completed.includes(task.id)).length +
      '/' +
      required.length;
    $('keySlot').textContent = 'КАССЕТЫ ' + state.echoes.length + '/5';
    $('codeSlot').textContent = floorReady(state) ? 'КОД ' + levelCode(state) : 'КОД НЕ СОБРАН';
    $('fuseSlot').classList.toggle('found', floorReady(state));
    $('keySlot').classList.toggle('found', state.echoes.includes(state.level));
    $('codeSlot').classList.toggle('found', floorReady(state));
  }
  world.sync(state);
}
function loadScene() {
  grid = createGrid(state.level);
  const renderer = world.renderer;
  world.dispose();
  world = makeWorld($('scene'), grid, settings, state.level, renderer);
}
function persistRecords() {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {}
}
function showChapters() {
  $('chapterList').replaceChildren();
  levels.forEach((level, index) => {
    const button = document.createElement('button');
    button.className = 'secondary chapter-card';
    button.disabled = index > records.unlocked;
    const best = records.best['floor-' + index];
    button.textContent =
      'Этаж ' +
      level.floor +
      ' · ' +
      level.title +
      (button.disabled
        ? ' · закрыт'
        : best
          ? ' · рекорд ' +
            Math.floor(best / 60) +
            ':' +
            Math.floor(best % 60)
              .toString()
              .padStart(2, '0')
          : '');
    button.addEventListener('click', () => {
      if (readSave() && !confirm('Начать выбранный этаж? Текущее сохранение будет заменено.'))
        return;
      start(false, index);
    });
    $('chapterList').append(button);
  });
  $('recordsText').textContent =
    'Пройденных кампаний — ' +
    records.wins +
    '. После финала откроется ежедневная смена с новыми кодами и расположением предметов.';
  showPanel('chaptersPanel');
}
function completeFloor() {
  const duration = state.elapsed - state.floorStarted;
  state.floorTimes[state.level] = duration;
  const key = 'floor-' + state.level;
  records.best[key] = Math.min(records.best[key] || Infinity, duration);
  records.unlocked = Math.max(records.unlocked, Math.min(4, state.level + 1));
  persistRecords();
  showPanel('transitionPanel');
  mode = 'transition';
  save();
  $('transitionLabel').textContent = 'ЭТАЖ ' + levels[state.level].floor + ' ПРОЙДЕН';
  $('transitionTitle').textContent = levels[state.level + 1].title;
  $('transitionText').textContent = levels[state.level + 1].intro;
  $('transitionStats').textContent =
    'Время этажа — ' +
    Math.floor(duration / 60) +
    ':' +
    Math.floor(duration % 60)
      .toString()
      .padStart(2, '0') +
    ' · Кассеты ' +
    state.echoes.length +
    '/5';
}
function descend() {
  const next = nextFloor(state);
  if (!next) return;
  state = next;
  state.floorStarted = state.elapsed;
  loadScene();
  resetEnemy();
  flashlight = true;
  updateObjective();
  save();
  resume();
  subtitle(levels[state.level].intro, 7);
}
function interactTask(id) {
  const task = tasksFor(state).find((task) => task.id === id);
  if (!task) return;
  if (task.kind === 'radio' && task.requires.every((id) => state.completed.includes(id))) {
    codeContext = 'radio';
    codeInput = '';
    updateCode();
    $('codeMessage').textContent = 'Введи частоту из записки. Четыре цифры.';
    showPanel('keypadPanel');
    return;
  }
  const result = completeTask(state, id);
  if (result.alarm) {
    enemy.grace = 0;
    enemy.alert = 5;
    enemy.lastSeen = { x: state.x, z: state.z };
    sound.noiseHit(0.8, 0.5, 600);
  }
  toast(result.message);
  if (result.ok) {
    sound.pickup();
    updateObjective();
    save();
    if (result.note) {
      $('noteTitle').textContent = result.title;
      $('noteSource').textContent = 'ЭТАЖ ' + levels[state.level].floor;
      $('noteText').textContent = result.note;
      showPanel('notePanel');
    }
  }
}
function resetEnemy() {
  enemy = {
    x: 23.5 * CELL,
    z: 8.5 * CELL,
    path: [],
    pathTimer: 0,
    patrol: 0,
    alert: 0,
    grace: 15,
    lastSeen: null,
    step: 0,
  };
}
function start(continuing = false, selectedLevel = 0, runMode = 'story') {
  state = continuing ? readSave() || freshState() : freshState();
  if (!continuing) {
    state.level = selectedLevel;
    state.runMode = runMode;
    state.seed = runMode === 'challenge' ? dailySeed() : 0;
    if (selectedLevel > 0) {
      state.power = true;
      state.key = true;
      state.doorOpen = true;
    }
  }
  state.started = true;
  state.crouch = false;
  finalWon = false;
  flashlight = true;
  loadScene();
  resetEnemy();
  updateObjective();
  $('menu').hidden = true;
  $('hud').hidden = false;
  $('endingPanel').hidden = true;
  $('overlay').hidden = true;
  mode = 'playing';
  sound.start();
  clearInput();
  lockPointer();
  save();
  subtitle(continuing ? 'Ночь ещё не закончилась.' : levels[state.level].intro, 6);
  if (!continuing)
    toast(
      touch
        ? 'Двигайся слева, осматривайся справа. Кнопка «Действие» берёт предмет.'
        : 'План этажа и найденные подсказки — в журнале.',
    );
}
function menu() {
  if (mode !== 'ending' && state.started) save();
  mode = 'menu';
  state.started = false;
  clearInput();
  leavePointer();
  sound.setActive(false);
  $('overlay').hidden = true;
  $('hud').hidden = true;
  $('menu').hidden = false;
  saved = readSave();
  $('continue').hidden = !saved;
  $('challengeButton').hidden = records.wins === 0;
}
function toggleLight() {
  if (mode !== 'playing') return;
  if (!flashlight && state.battery < 3) {
    toast('Батарея разряжена. Подожди несколько секунд.');
    return;
  }
  flashlight = !flashlight;
  sound.click();
}
function note(id) {
  if (!state.notes.includes(id)) state.notes.push(id);
  const n = noteData[id];
  $('noteTitle').textContent = n.title;
  $('noteSource').textContent = n.source;
  $('noteText').textContent =
    id === 'code' && state.runMode === 'challenge'
      ? 'Время на табло изменилось. Код лестницы — ' + levelCode(state) + '.'
      : n.text;
  showPanel('notePanel');
  save();
}
function getTarget() {
  let best = null,
    bestDistance = touch ? 3.9 : 3.1;
  for (const object of world.objects) {
    if (
      (object.id === 'fuse' && state.fuse) ||
      (object.id === 'key' && (!state.power || state.key)) ||
      (object.id === 'door' && state.doorOpen)
    )
      continue;
    if (object.id.startsWith('task:')) {
      const id = object.id.slice(5);
      if (state.completed.includes(id)) continue;
    }
    const dx = object.x - state.x,
      dz = object.z - state.z,
      distance = Math.hypot(dx, dz);
    const dot = (Math.sin(state.yaw) * dx - Math.cos(state.yaw) * dz) / (distance || 1);
    if (
      distance < bestDistance &&
      dot > (touch ? 0.12 : 0.45) &&
      visible(grid, state, object, state.doorOpen)
    ) {
      best = object;
      bestDistance = distance;
    }
  }
  return best;
}
function interact() {
  if (mode !== 'playing' || !target) return;
  sound.click();
  if (target.id.startsWith('task:')) {
    interactTask(target.id.slice(5));
    return;
  }
  switch (target.id) {
    case 'warning':
      note('warning');
      return;
    case 'diary':
      note('diary');
      return;
    case 'fuse':
      state.fuse = true;
      sound.pickup();
      subtitle('Подойдёт. Щитовая напротив.');
      toast('Найден предохранитель');
      break;
    case 'panel':
      if (state.power) {
        toast('Питание восстановлено. Ключ висит рядом.');
        return;
      }
      if (!state.fuse) {
        toast('Нужен предохранитель из кладовой.');
        return;
      }
      state.power = true;
      enemy.grace = 16;
      sound.tone(90, 0.8, 0.14, 'sawtooth', 45);
      subtitle('Питание есть. А эти шаги… были и раньше?', 6);
      toast('Питание восстановлено. Появился ключ.');
      break;
    case 'key':
      state.key = true;
      sound.pickup();
      toast('Найден ключ от комнаты 13');
      subtitle('Тринадцатая — в дальнем конце коридора.');
      break;
    case 'door':
      if (!state.key) {
        toast('Заперто. Ключ рядом со щитком.');
        return;
      }
      state.doorOpen = true;
      sound.noiseHit(0.7, 0.5, 500);
      subtitle('Телефон… кто-то оставил записку.');
      break;
    case 'code':
      state.code = true;
      note('code');
      updateObjective();
      return;
    case 'exit':
      codeContext = 'exit';
      codeInput = '';
      if (state.level > 0) {
        $('codeMessage').textContent = floorReady(state)
          ? 'Код сохранён в журнале.'
          : 'Сначала выполни задачи этажа.';
        updateCode();
        showPanel('keypadPanel');
        return;
      }
      $('codeMessage').textContent = state.code
        ? 'Код из записки сохранён в журнале.'
        : 'Четыре цифры. Записка в комнате 13.';
      updateCode();
      showPanel('keypadPanel');
      return;
  }
  updateObjective();
  save();
}
function updateCode() {
  $('codeDisplay').textContent = codeInput.padEnd(4, '—').split('').join(' ');
}
function codeKey(key) {
  if ($('keypadPanel').hidden) return;
  if (key === '⌫') codeInput = codeInput.slice(0, -1);
  else if (key === '↵') {
    if (codeContext === 'radio' && codeInput === '3142') {
      completeTask(state, 'radio');
      updateObjective();
      save();
      resume();
      subtitle('Сигнал пойман. Расшифровка появилась в тихой комнате.');
      return;
    }
    if (codeContext === 'exit' && codeInput === levelCode(state) && floorReady(state)) {
      finish(true);
      return;
    }
    $('codeMessage').textContent =
      codeContext === 'exit' && codeInput === levelCode(state)
        ? 'Сначала найди записку в комнате 13.'
        : 'Неверный код. Попробуй ещё раз.';
    codeInput = '';
    sound.start();
    sound.tone(110, 0.15, 0.05);
    sound.setActive(false);
  } else if (codeInput.length < 4) codeInput += key;
  updateCode();
}
for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '↵']) {
  const b = document.createElement('button');
  b.textContent = key;
  b.setAttribute('aria-label', key === '⌫' ? 'Стереть' : key === '↵' ? 'Подтвердить' : key);
  b.addEventListener('click', () => codeKey(key));
  $('keypad').append(b);
}
function journal() {
  if (!state.started) return;
  $('notes').replaceChildren();
  const objective = document.createElement('p');
  objective.textContent =
    state.level === 0 ? objectives[stage(state)][1] : campaignObjective(state);
  $('notes').append(objective);
  for (const task of tasksFor(state)) {
    const p = document.createElement('p');
    p.textContent =
      (state.completed.includes(task.id) ? '✓ ' : '○ ') +
      task.label +
      (task.optional ? ' · необязательно' : '');
    $('notes').append(p);
    if (state.completed.includes(task.id) && task.note) {
      const detail = document.createElement('p');
      detail.className = 'journal-detail';
      detail.textContent = task.note;
      $('notes').append(detail);
    }
  }
  for (const id of state.notes) {
    const article = document.createElement('article');
    const title = document.createElement('strong');
    title.textContent = noteData[id].title;
    const text = document.createElement('p');
    text.textContent =
      id === 'code' && state.runMode === 'challenge'
        ? 'Код лестницы — ' + levelCode(state)
        : noteData[id].text;
    article.append(title, text);
    $('notes').append(article);
  }
  if (!state.notes.length) {
    const p = document.createElement('p');
    p.textContent = 'Найденные записки появятся здесь.';
    $('notes').append(p);
  }
  const ctx = $('map').getContext('2d');
  ctx.fillStyle = '#0a110e';
  ctx.fillRect(0, 0, 540, 300);
  const scale = 18,
    ox = 26,
    oz = 8;
  for (let z = 0; z < grid.length; z++)
    for (let x = 0; x < grid[z].length; x++)
      if (grid[z][x] === 0) {
        ctx.fillStyle = '#53614c';
        ctx.fillRect(ox + x * scale, oz + z * scale, scale - 1, scale - 1);
      }
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2c691';
  for (const [text, x, z] of [
    ['Щитовая', 5.5, 4.5],
    ['Тихая', 12.8, 4.5],
    ['13', 21.5, 4.5],
    ['Кладовая', 6.5, 12.5],
    ['Отдых', 18.5, 12.5],
  ])
    ctx.fillText(text, ox + x * scale, oz + z * scale);
  ctx.fillStyle = '#a9dbbc';
  ctx.fillText('ЛЕСТНИЦА', ox + 3 * scale, oz + 8 * scale - 5);
  ctx.fillStyle = '#f0d19a';
  ctx.beginPath();
  ctx.arc(ox + (state.x / CELL) * scale, oz + (state.z / CELL) * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f0d19a';
  ctx.beginPath();
  const px = ox + (state.x / CELL) * scale,
    pz = oz + (state.z / CELL) * scale;
  ctx.moveTo(px, pz);
  ctx.lineTo(px + Math.sin(state.yaw) * 12, pz - Math.cos(state.yaw) * 12);
  ctx.stroke();
  showPanel('journalPanel');
}
function finish(won) {
  finalWon = won;
  if (won && state.level < levels.length - 1) {
    completeFloor();
    return;
  }
  if (won) {
    const floorKey = 'floor-' + state.level;
    records.best[floorKey] = Math.min(
      records.best[floorKey] || Infinity,
      state.elapsed - state.floorStarted,
    );
    records.wins++;
    records.unlocked = 4;
    const key = state.runMode === 'challenge' ? 'daily-' + state.seed : 'campaign';
    records.best[key] = Math.min(records.best[key] || Infinity, state.elapsed);
    persistRecords();
  }
  showPanel('endingPanel');
  mode = 'ending';
  $('endingLabel').textContent = won ? '06 / ПЕРВЫЙ СВЕТ' : 'ЭТАЖ ТЕБЯ ЗАПОМНИЛ';
  $('endingTitle').textContent = won ? 'Ты вышел.' : 'Слишком громко.';
  $('endingText').textContent = won
    ? 'Лестница вывела на первый этаж. За окнами уже светало.\n\nНа табло лифта было «12».\nТы всё равно пошёл пешком.'
    : 'Шаги остановились прямо за спиной.\n\nОчнёшься в тихой комнате. Найденные предметы останутся с тобой. Погаси свет, присядь и пережди за стеной, когда оно рядом.';
  const mins = Math.floor(state.elapsed / 60),
    secs = Math.floor(state.elapsed % 60)
      .toString()
      .padStart(2, '0');
  $('resultStats').textContent =
    `Время ${mins}:${secs} · Этаж ${state.level + 1}/5 · Кассеты ${state.echoes.length}/5 · Поимки ${state.catches}`;
  $('retry').textContent = won ? 'Пройти ещё раз ↗' : 'Очнуться в тихой комнате ↗';
  if (won) {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
    saved = null;
  }
}
function caught() {
  if (mode !== 'playing') return;
  state.catches++;
  sound.scare();
  mode = 'caught';
  caughtUntil = clock + 1.1;
  clearInput();
  leavePointer();
  $('danger').style.opacity = '.85';
  // Return the camera to the creature for one short, non-flashing scare.
  state.yaw = Math.atan2(enemy.x - state.x, -(enemy.z - state.z));
  state.pitch = 0;
}
function retry() {
  if (finalWon) {
    start(false);
    return;
  }
  state.x = 12.5 * CELL;
  state.z = 4.8 * CELL;
  state.yaw = Math.PI;
  state.pitch = 0;
  state.battery = Math.max(50, state.battery);
  state.stamina = 100;
  state.crouch = false;
  if (state.level === 4 && state.completed.includes('generator')) state.escapeRemaining = 180;
  resetEnemy();
  updateObjective();
  save();
  resume();
  subtitle('Тихая комната. Зелёный свет. Здесь можно отдышаться.');
}

// Keyboard, mouse and independent multitouch pointers share one input state.
window.addEventListener('keydown', (event) => {
  if (
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(event.code) &&
    mode === 'playing'
  )
    event.preventDefault();
  if (!$('keypadPanel').hidden) {
    if (/^[0-9]$/.test(event.key)) codeKey(event.key);
    if (event.key === 'Backspace') codeKey('⌫');
    if (event.key === 'Enter') codeKey('↵');
  }
  if (event.code === 'Escape') {
    if (mode === 'playing') pause();
    else if (mode === 'paused') back();
    return;
  }
  if (mode !== 'playing') return;
  input.keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'KeyF') toggleLight();
  if (event.code === 'KeyC') {
    state.crouch = !state.crouch;
    sound.click();
  }
  if (event.code === 'KeyE') interact();
  if (event.code === 'KeyJ') journal();
});
window.addEventListener('keyup', (event) => input.keys.delete(event.code));
window.addEventListener('blur', () => {
  if (mode === 'playing') pause();
  clearInput();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (mode === 'playing') pause();
    clearInput();
  }
});
window.addEventListener('pagehide', () => {
  if (mode !== 'ending') save();
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && mode === 'playing' && !touch) pause();
});
function look(dx, dy) {
  const factor = settings.sensitivity * 0.000035;
  state.yaw += dx * factor;
  state.pitch = Math.max(-1.02, Math.min(1.02, state.pitch - dy * factor));
}
document.addEventListener('mousemove', (event) => {
  if (mode === 'playing' && document.pointerLockElement) look(event.movementX, event.movementY);
});
$('scene').addEventListener('pointerdown', (event) => {
  if (mode !== 'playing') return;
  if (event.pointerType !== 'mouse') return;
  if (event.pointerType === 'mouse') {
    if (!document.pointerLockElement) lockPointer();
  }
  input.look = { id: event.pointerId, x: event.clientX, y: event.clientY };
  $('scene').setPointerCapture(event.pointerId);
});
$('scene').addEventListener('pointermove', (event) => {
  if (mode !== 'playing' || document.pointerLockElement || input.look?.id !== event.pointerId)
    return;
  look(event.clientX - input.look.x, event.clientY - input.look.y);
  input.look.x = event.clientX;
  input.look.y = event.clientY;
});
function releaseLook(event) {
  if (input.look?.id === event.pointerId) input.look = null;
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
  $('scene').addEventListener(type, releaseLook);
$('joystick').addEventListener('pointerdown', (event) => {
  if (mode !== 'playing') return;
  event.preventDefault();
  input.stick = event.pointerId;
  $('joystick').setPointerCapture(event.pointerId);
  moveStick(event);
});
function moveStick(event) {
  if (input.stick !== event.pointerId) return;
  const rect = $('joystick').getBoundingClientRect();
  let x = (event.clientX - rect.left - rect.width / 2) / (rect.width * 0.35),
    y = (event.clientY - rect.top - rect.height / 2) / (rect.height * 0.35);
  const len = Math.max(1, Math.hypot(x, y));
  x /= len;
  y /= len;
  input.moveX = x;
  input.moveZ = -y;
  $('stick').style.transform = `translate(${x * rect.width * 0.28}px,${y * rect.height * 0.28}px)`;
}
$('joystick').addEventListener('pointermove', moveStick);
function releaseStick(event) {
  if (input.stick !== event.pointerId) return;
  input.stick = null;
  input.moveX = 0;
  input.moveZ = 0;
  $('stick').style.transform = '';
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
  $('joystick').addEventListener(type, releaseStick);
$('touchRun').addEventListener('click', () => {
  if (mode === 'playing') {
    input.run = !input.run;
    $('touchRun').classList.toggle('active', input.run);
  }
});
touchController = bindTouch({
  canvas: $('scene'),
  joystick: $('joystick'),
  stick: $('stick'),
  active: () => mode === 'playing',
  look,
  settings,
  onChange: (x, z) => {
    input.moveX = x;
    input.moveZ = z;
  },
  onInteract: () => {
    target = getTarget();
    interact();
  },
});
$('touchInteract').addEventListener('click', interact);
$('touchLight').addEventListener('click', toggleLight);
$('touchCrouch').addEventListener('click', () => {
  if (mode === 'playing') state.crouch = !state.crouch;
});
$('touchJournal').addEventListener('click', journal);
$('pauseButton').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('start').addEventListener('click', () => {
  if (readSave() && !confirm('Начать заново? Текущее прохождение будет заменено.')) return;
  start(false);
});
$('continue').addEventListener('click', () => start(true));
$('toMenu').addEventListener('click', menu);
$('endingMenu').addEventListener('click', menu);
$('retry').addEventListener('click', retry);
$('journalButton').addEventListener('click', journal);
$('touchJournalTop').addEventListener('click', journal);
$('chaptersButton').addEventListener('click', showChapters);
$('nextFloorButton').addEventListener('click', descend);
$('challengeButton').addEventListener('click', () => {
  if (readSave() && !confirm('Начать ежедневную смену вместо текущего прохождения?')) return;
  start(false, 0, 'challenge');
});
for (const button of document.querySelectorAll('.backButton'))
  button.addEventListener('click', back);
function openSettings() {
  previousPanel = state.started ? 'pausePanel' : 'menu';
  showPanel('settingsPanel');
}
$('menuSettings').addEventListener('click', openSettings);
$('settingsButton').addEventListener('click', openSettings);
for (const name of Object.keys(DEFAULT_SETTINGS)) {
  const el = $(name);
  if (el.type === 'checkbox') el.checked = settings[name];
  else el.value = settings[name];
  el.addEventListener('input', () => {
    settings[name] =
      el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
    sound.setVolume(settings.volume / 100);
    world.resize();
    document.documentElement.style.setProperty('--control-scale', settings.controlScale / 100);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  });
}
window.addEventListener('resize', () => world.resize());
let contextLost = false;
$('scene').addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  contextLost = true;
  if (mode === 'playing') pause();
  toast('3D приостановлен. Перезагрузи страницу — прогресс сохранён.');
});
$('scene').addEventListener('webglcontextrestored', () => location.reload());

function movePlayer(dt) {
  let forward =
    input.moveZ +
    (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0) -
    (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0);
  let side = input.moveX + (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);
  if (input.keys.has('ArrowLeft')) state.yaw -= dt * 1.65;
  if (input.keys.has('ArrowRight')) state.yaw += dt * 1.65;
  const length = Math.hypot(forward, side);
  if (length > 1) {
    forward /= length;
    side /= length;
  }
  const moving = length > 0.12,
    run =
      moving &&
      !state.crouch &&
      state.stamina > 3 &&
      (input.run ||
        (touch && settings.autoRun && input.moveZ > 0.94) ||
        input.keys.has('ShiftLeft') ||
        input.keys.has('ShiftRight'));
  const speed = state.crouch ? 1.18 : run ? 4.15 : 2.45;
  const dx = (Math.sin(state.yaw) * forward + Math.cos(state.yaw) * side) * speed * dt;
  const dz = (-Math.cos(state.yaw) * forward + Math.sin(state.yaw) * side) * speed * dt;
  if (canStand(grid, state.x + dx, state.z, state.doorOpen)) state.x += dx;
  if (canStand(grid, state.x, state.z + dz, state.doorOpen)) state.z += dz;
  state.stamina = Math.max(0, Math.min(100, state.stamina + (run ? -24 : 15) * dt));
  state.running = run;
  stepClock += dt;
  if (moving && stepClock > (run ? 0.3 : state.crouch ? 0.82 : 0.52)) {
    sound.step(false, 0, state.crouch ? 0.3 : run ? 1.25 : 0.7);
    stepClock = 0;
  }
  return moving && settings.motion
    ? Math.sin(clock * (run ? 14 : 9)) * (state.crouch ? 0.012 : 0.027)
    : 0;
}
function updateEnemy(dt) {
  world.monster.visible = state.power;
  if (!state.power) return 0;
  const safe = state.x > 11 * CELL && state.x < 15 * CELL && state.z < 7 * CELL;
  const distance = Math.hypot(enemy.x - state.x, enemy.z - state.z);
  const line = visible(grid, enemy, state, state.doorOpen);
  const range = flashlight ? 13 : state.crouch ? 2.4 : 5.5;
  enemy.grace = Math.max(0, enemy.grace - dt);
  const detects =
    !safe &&
    enemy.grace === 0 &&
    settings.difficulty !== 'story' &&
    ((line && distance < range) || (state.running && distance < 10));
  if (detects) {
    enemy.alert = 4.5;
    enemy.lastSeen = { x: state.x, z: state.z };
  } else enemy.alert = Math.max(0, enemy.alert - dt);
  enemy.pathTimer -= dt;
  const chase = enemy.alert > 0;
  const goal = chase ? enemy.lastSeen : patrol[enemy.patrol];
  if (!chase && Math.hypot(enemy.x - goal.x, enemy.z - goal.z) < 0.7)
    enemy.patrol = (enemy.patrol + 1) % patrol.length;
  if (enemy.pathTimer <= 0) {
    enemy.path = findPath(grid, enemy, goal, state.doorOpen);
    enemy.pathTimer = 0.6;
  }
  const next = enemy.path[0];
  if (next) {
    const dx = next.x - enemy.x,
      dz = next.z - enemy.z,
      length = Math.hypot(dx, dz);
    const speed = chase ? (settings.difficulty === 'hard' ? 3.15 : 2.7) : 1.12;
    const amount = Math.min(length, speed * dt);
    if (length > 0.001) {
      enemy.x += (dx / length) * amount;
      enemy.z += (dz / length) * amount;
      world.monster.rotation.y = Math.atan2(dx, dz);
    }
    if (length < 0.15) enemy.path.shift();
  }
  world.monster.position.set(enemy.x, Math.sin(clock * 5) * 0.025, enemy.z);
  enemy.step += dt;
  if (distance < 16 && enemy.step > (chase ? 0.38 : 0.8)) {
    const angle = Math.atan2(enemy.x - state.x, -(enemy.z - state.z)) - state.yaw;
    sound.step(true, Math.sin(angle), Math.max(0.06, (1 - distance / 18) * (line ? 1 : 0.32)));
    enemy.step = 0;
  }
  const threat = safe
    ? 0
    : chase
      ? Math.max(0.4, 1 - distance / 16)
      : line
        ? Math.max(0, 1 - distance / 8) * 0.4
        : 0;
  sound.heartbeat(threat, clock);
  if (distance < 0.78 && enemy.grace === 0 && !safe && settings.difficulty !== 'story') caught();
  return threat;
}
function hud(threat) {
  target = getTarget();
  $('interaction').hidden = !target;
  if (target) $('interactionLabel').textContent = target.label;
  $('touchInteract').style.opacity = target ? '1' : '.45';
  $('touchInteract').classList.toggle('available', Boolean(target));
  $('escapeTimer').hidden = state.level !== 4 || state.escapeRemaining <= 0;
  if (state.escapeRemaining > 0) {
    const remaining = Math.ceil(state.escapeRemaining);
    $('escapeTimer').textContent =
      'ДО ОТКЛЮЧЕНИЯ ' + Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
  }
  $('batteryValue').textContent = Math.ceil(state.battery) + '%';
  $('batteryBar').style.width = state.battery + '%';
  $('staminaBar').style.width = state.stamina + '%';
  $('lightStatus').textContent = flashlight ? 'СВЕТ ВКЛЮЧЁН' : 'СВЕТ ВЫКЛЮЧЕН';
  $('stance').textContent = state.crouch ? 'Тихий шаг' : state.running ? 'Бег' : 'Стоя';
  $('danger').style.opacity = String(threat * 0.5);
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  clock += dt;
  let bob = 0;
  if (mode === 'playing') {
    state.elapsed += dt;
    if (state.level === 4 && state.escapeRemaining > 0 && settings.difficulty !== 'story') {
      state.escapeRemaining = Math.max(0, state.escapeRemaining - dt);
      if (state.escapeRemaining === 0) {
        caught();
      }
    }
    bob = movePlayer(dt);
    state.battery = Math.max(0, Math.min(100, state.battery + (flashlight ? -0.48 : 2.5) * dt));
    if (state.battery === 0 && flashlight) {
      flashlight = false;
      toast('Батарея села. Выключенный фонарик восстанавливает заряд.');
    }
    const threat = updateEnemy(dt);
    hud(threat);
    saveClock += dt;
    if (saveClock > 5) {
      save();
      saveClock = 0;
    }
  } else if (mode === 'caught' && clock > caughtUntil) {
    $('danger').style.opacity = '0';
    finish(false);
  }
  if (clock > subtitleUntil) $('subtitle').textContent = '';
  if (clock > toastUntil) $('toast').classList.remove('show');
  if (!contextLost)
    world.render(state, clock, mode === 'playing' || mode === 'caught', flashlight, bob);
}
saved = readSave();
$('continue').hidden = !saved;
$('challengeButton').hidden = records.wins === 0;
document.documentElement.style.setProperty('--control-scale', settings.controlScale / 100);
world.sync(state);
$('loading').hidden = true;
requestAnimationFrame(loop);
if ('serviceWorker' in navigator && location.protocol !== 'file:')
  navigator.serviceWorker.register('./sw.js').catch(() => {});
