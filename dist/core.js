// World rules are independent from rendering and input.
export const CELL = 1.6;
export const WIDTH = 27;
export const HEIGHT = 17;
export const SAVE_KEY = 'floor13-save-v1';
export const SETTINGS_KEY = 'floor13-settings-v1';
export const DEFAULT_SETTINGS = {
  volume: 65,
  brightness: 115,
  sensitivity: 80,
  quality: 'medium',
  difficulty: 'normal',
  motion: true,
  tapInteract: true,
  autoRun: true,
  controlScale: 115,
};
export const objectives = [
  ['01 / ЧУЖОЙ ЭТАЖ', 'Найди предохранитель в кладовой.'],
  ['02 / РЕЗЕРВНОЕ ПИТАНИЕ', 'Установи предохранитель в щиток.'],
  ['03 / КОМНАТА БЕЗ НОМЕРА', 'Забери ключ у щитка. Найди комнату 13.'],
  ['04 / ПОСЛЕ ОТБОЯ', 'Найди код лестницы в комнате 13.'],
  ['05 / НЕ ОГЛЯДЫВАЙСЯ', 'Вернись к лестнице. Введи код и уходи.'],
];
export const noteData = {
  warning: {
    title: 'Правила ночной смены',
    source: 'ОБЪЯВЛЕНИЕ У ЛИФТА',
    text: 'Если лифт остановился на тринадцатом — не жди следующий.\n\nРезервный предохранитель в кладовой. Щиток — напротив. Ключ от комнаты 13 висит рядом со щитком.\n\nНе беги, пока оно рядом. Выключи фонарик и присядь в комнате. За стеной оно тебя не видит.\n\nЛестница — в западном конце коридора.',
  },
  diary: {
    title: 'Записка дежурного',
    source: 'СТОЛ В КОМНАТЕ ОТДЫХА',
    text: 'Свет — это приглашение. Оно смотрит туда, куда ты светишь.\n\nКогда услышишь частые шаги, уйди за стену, погаси фонарик и присядь. Через несколько секунд оно потеряет тебя.\n\nВ комнате с зелёной лампой можно отдышаться. Батарейка медленно заряжается, пока фонарик выключен.',
  },
  code: {
    title: 'Время последнего звонка',
    source: 'КОМНАТА 13 · ЗАПИСКА ПОД ТЕЛЕФОНОМ',
    text: 'Мама позвонила в 02:13. Я не ответил.\n\nНа замке лестницы всё ещё стоит это время.\n\nКОД: 0213\n\nЕсли ты читаешь это — возвращайся к лестнице. Не жди меня.',
  },
};
export function createGrid(level = 0) {
  const grid = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(1));
  function room(x1, z1, x2, z2) {
    for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) grid[z][x] = 0;
  }
  room(1, 8, 24, 9);
  room(3, 3, 7, 6);
  room(5, 7, 5, 7);
  room(11, 3, 14, 6);
  room(12, 7, 12, 7);
  room(19, 3, 23, 6);
  room(21, 7, 21, 7);
  room(4, 11, 8, 14);
  room(6, 10, 6, 10);
  room(16, 11, 20, 14);
  room(18, 10, 18, 10);
  if (level === 1 || level === 3) {
    room(3, 1, 23, 2);
    room(5, 2, 5, 3);
    room(12, 2, 12, 3);
    room(21, 2, 21, 3);
  }
  if (level === 2 || level === 4) {
    room(4, 15, 20, 15);
    room(6, 14, 6, 15);
    room(18, 14, 18, 15);
  }
  if (level === 3) {
    grid[8][16] = 1;
    grid[9][16] = 1;
  }
  if (level === 4) {
    grid[8][10] = 1;
    grid[9][10] = 1;
  }
  return grid;
}
export function isOpen(grid, x, z, doorOpen = true) {
  const gx = Math.floor(x / CELL),
    gz = Math.floor(z / CELL);
  if (!doorOpen && gx === 21 && gz === 7) return false;
  return grid[gz]?.[gx] === 0;
}
export function canStand(grid, x, z, doorOpen = true, radius = 0.22) {
  return [
    [-radius, -radius],
    [radius, -radius],
    [-radius, radius],
    [radius, radius],
  ].every(([dx, dz]) => isOpen(grid, x + dx, z + dz, doorOpen));
}
export function visible(grid, a, b, doorOpen = true) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(length / 0.25));
  for (let i = 1; i < steps; i++)
    if (!isOpen(grid, a.x + ((b.x - a.x) * i) / steps, a.z + ((b.z - a.z) * i) / steps, doorOpen))
      return false;
  return true;
}
export function findPath(grid, start, end, doorOpen = true) {
  const sx = Math.floor(start.x / CELL),
    sz = Math.floor(start.z / CELL);
  const ex = Math.floor(end.x / CELL),
    ez = Math.floor(end.z / CELL);
  const queue = [[sx, sz]],
    parents = new Map([[`${sx},${sz}`, null]]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    if (x === ex && z === ez) {
      const path = [];
      let current = [x, z];
      while (current) {
        path.unshift({ x: (current[0] + 0.5) * CELL, z: (current[1] + 0.5) * CELL });
        current = parents.get(current.join(','));
      }
      return path.slice(1);
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        key = `${nx},${nz}`;
      if (!parents.has(key) && isOpen(grid, (nx + 0.5) * CELL, (nz + 0.5) * CELL, doorOpen)) {
        parents.set(key, [x, z]);
        queue.push([nx, nz]);
      }
    }
  }
  return [];
}
export function freshState() {
  return {
    version: 2,
    level: 0,
    completed: [],
    echoes: [],
    runMode: 'story',
    seed: 0,
    escapeRemaining: 0,
    floorTimes: [],
    floorStarted: 0,
    x: 4.5 * CELL,
    z: 8.7 * CELL,
    yaw: Math.PI / 2,
    pitch: 0,
    battery: 100,
    stamina: 100,
    fuse: false,
    power: false,
    key: false,
    doorOpen: false,
    code: false,
    notes: [],
    elapsed: 0,
    catches: 0,
  };
}
export function stage(state) {
  if (state.code) return 4;
  if (state.doorOpen) return 3;
  if (state.power) return 2;
  if (state.fuse) return 1;
  return 0;
}
export function parseSave(raw, grid) {
  try {
    const s = JSON.parse(raw);
    if (![1, 2].includes(s?.version)) return null;
    const base = freshState();
    base.level = Number.isInteger(s.level) && s.level >= 0 && s.level < 5 ? s.level : 0;
    if (s.version === 2 && s.level !== base.level) return null;
    base.completed = Array.isArray(s.completed)
      ? [...new Set(s.completed.filter((id) => typeof id === 'string' && id.length < 40))]
      : [];
    base.echoes = Array.isArray(s.echoes)
      ? [...new Set(s.echoes.filter((id) => Number.isInteger(id) && id >= 0 && id < 5))]
      : [];
    base.runMode = s.runMode === 'challenge' ? 'challenge' : 'story';
    base.seed = Number.isInteger(s.seed) ? s.seed >>> 0 : 0;
    base.escapeRemaining = Math.max(0, Math.min(180, Number(s.escapeRemaining) || 0));
    base.floorTimes = Array.isArray(s.floorTimes)
      ? s.floorTimes.slice(0, 5).map((n) => Math.max(0, Number(n) || 0))
      : [];
    base.floorStarted = Math.max(0, Math.min(Number(s.elapsed) || 0, Number(s.floorStarted) || 0));
    grid = createGrid(base.level);
    for (const name of ['x', 'z', 'yaw', 'pitch', 'battery', 'stamina', 'elapsed', 'catches']) {
      if (!Number.isFinite(s[name])) return null;
      base[name] = s[name];
    }
    for (const name of ['fuse', 'power', 'key', 'doorOpen', 'code']) base[name] = s[name] === true;
    if (
      (base.level === 0 && base.power && !base.fuse) ||
      (base.key && !base.power) ||
      (base.doorOpen && !base.key) ||
      (base.code && !base.doorOpen)
    )
      return null;
    if (!canStand(grid, base.x, base.z, base.doorOpen)) return null;
    base.battery = Math.max(0, Math.min(100, base.battery));
    base.stamina = Math.max(0, Math.min(100, base.stamina));
    base.pitch = Math.max(-1, Math.min(1, base.pitch));
    base.elapsed = Math.max(0, base.elapsed);
    base.catches = Math.max(0, Math.floor(base.catches));
    base.notes = Array.isArray(s.notes) ? s.notes.filter((id) => Object.hasOwn(noteData, id)) : [];
    return base;
  } catch {
    return null;
  }
}
