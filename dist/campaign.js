// Five connected floors. Gameplay rules are kept outside the renderer.
export const RECORDS_KEY = 'floor13-records-v2';
export const levels = [
  {
    floor: '13',
    title: 'После отбоя',
    intro: 'Здесь должен был быть двенадцатый этаж…',
    color: 0xffffff,
    fog: 0x08100e,
    code: '0213',
  },
  {
    floor: '12',
    title: 'Архив голосов',
    intro: 'За лестницей снова коридор. На этот раз двери соединены проходом за стеной.',
    color: 0xb7c9dd,
    fog: 0x080d18,
    code: '4826',
  },
  {
    floor: '11',
    title: 'Под давлением',
    intro: 'Трубы гудят. Пар перекрыл лестницу. На вентилях осталась инструкция.',
    color: 0xc5a58a,
    fog: 0x170e09,
    code: '7319',
  },
  {
    floor: '10',
    title: 'Мёртвая частота',
    intro: 'Сквозь помехи кто-то называет твой этаж. Радиостанции не хватает питания.',
    color: 0xc5becd,
    fog: 0x100b17,
    code: '6054',
  },
  {
    floor: '−1',
    title: 'Последняя смена',
    intro: 'Подвал. За дверью слышен дождь. Запусти генератор и успей выйти.',
    color: 0x97b8ad,
    fog: 0x06100e,
    code: '1907',
  },
];

const anchors = {
  storage: [7, 13.4],
  utility: [4.2, 4.7],
  quiet: [13.4, 5.5],
  lounge: [18, 13.6],
  far: [21.5, 4.3],
  hallway: [16, 8.5],
};
function item(id, label, where, extra = {}) {
  const [x, z] = anchors[where];
  return { id, label, x: x * 1.6, z: z * 1.6, y: 1.05, kind: 'pickup', ...extra };
}
export function levelCode(state) {
  if (state.runMode !== 'challenge') return levels[state.level].code;
  let n = (state.seed + state.level * 7919) >>> 0;
  n = (n * 1664525 + 1013904223) >>> 0;
  return String(n % 10000).padStart(4, '0');
}
export function tasksFor(state) {
  const code = levelCode(state);
  let tasks = [];
  if (state.level === 1)
    tasks = [
      item('fileA', 'Взять карточку A', 'storage', {
        note: `Карточка A. Первые две цифры — ${code.slice(0, 2)}.`,
      }),
      item('fileB', 'Взять карточку B', 'lounge', {
        note: `Карточка B. Третья цифра — ${code[2]}.`,
      }),
      item('fileC', 'Взять карточку C', 'far', {
        note: `Карточка C. Последняя цифра — ${code[3]}.`,
      }),
      item('archive', 'Собрать код в терминале', 'utility', {
        kind: 'console',
        requires: ['fileA', 'fileB', 'fileC'],
        note: `Архив разблокирован. Код лестницы — ${code}.`,
      }),
    ];
  if (state.level === 2)
    tasks = [
      item('valveNote', 'Прочитать инструкцию', 'lounge', {
        note: 'Сначала СИНИЙ, потом КРАСНЫЙ, затем ЗОЛОТОЙ. Ошибка сбрасывает давление и привлекает его.',
      }),
      item('blue', 'Закрыть синий вентиль', 'storage', {
        kind: 'valve',
        color: 0x79b4df,
        order: 0,
      }),
      item('red', 'Закрыть красный вентиль', 'far', { kind: 'valve', color: 0xd96d55, order: 1 }),
      item('gold', 'Закрыть золотой вентиль', 'utility', {
        kind: 'valve',
        color: 0xd2b56d,
        order: 2,
      }),
      item('pressure', 'Снять блокировку давления', 'quiet', {
        kind: 'console',
        requires: ['blue', 'red', 'gold'],
        note: `Давление в норме. Код лестницы — ${code}.`,
      }),
    ];
  if (state.level === 3)
    tasks = [
      item('batteryA', 'Взять аккумулятор A', 'storage'),
      item('batteryB', 'Взять аккумулятор B', 'far'),
      item('frequency', 'Прочитать сетку частот', 'utility', {
        note: 'Частота дежурного — 3142. Вставь оба аккумулятора и введи её на радиостанции в комнате отдыха.',
      }),
      item('radio', 'Настроить радиостанцию', 'lounge', {
        kind: 'radio',
        requires: ['batteryA', 'batteryB', 'frequency'],
      }),
      item('transcript', 'Забрать расшифровку', 'quiet', {
        requires: ['radio'],
        note: `Из динамика: «Лестница… ${code.split('').join('… ')}. Не отвечай голосу за дверью».`,
      }),
    ];
  if (state.level === 4)
    tasks = [
      item('cellA', 'Взять силовой модуль A', 'storage'),
      item('cellB', 'Взять силовой модуль B', 'far'),
      item('cellC', 'Взять силовой модуль C', 'lounge'),
      item('generator', 'Запустить генератор', 'utility', {
        kind: 'console',
        requires: ['cellA', 'cellB', 'cellC'],
        note: `Генератор работает три минуты. Выход у лестницы. Код — ${code}.`,
      }),
    ];
  if (state.runMode === 'challenge') {
    // Stable rotation of the three distant pickup locations changes every daily run.
    const spots = ['storage', 'lounge', 'far'];
    const shift = (state.seed + state.level) % spots.length;
    for (const task of tasks)
      if (task.kind === 'pickup' && !task.requires) {
        const index = spots.findIndex(
          (s) => task.x === anchors[s][0] * 1.6 && task.z === anchors[s][1] * 1.6,
        );
        if (index >= 0) {
          const [x, z] = anchors[spots[(index + shift) % spots.length]];
          task.x = x * 1.6;
          task.z = z * 1.6;
        }
      }
  }
  tasks.push(
    item('echo', 'Прослушать оставленную кассету', 'quiet', {
      optional: true,
      note: [
        '«Я спустился на этаж ниже. В окнах всё та же ночь».',
        '«В архиве голоса записаны раньше, чем их произнесли».',
        '«Пар остановился. Шаги — нет».',
        '«Если радио зовёт тебя по имени, выключи его».',
        '«Дождь настоящий. Просто открой последнюю дверь».',
      ][state.level],
    }),
  );
  // Do not overlap the optional cassette with a mandatory terminal.
  const echo = tasks.at(-1);
  if (state.level === 2 || state.level === 3) {
    echo.x = 11.5 * 1.6;
    echo.z = 3.8 * 1.6;
  }
  return tasks;
}
export function hasTask(state, id) {
  return state.completed.includes(id);
}
export function floorReady(state) {
  if (state.level === 0) return state.code;
  return tasksFor(state)
    .filter((task) => !task.optional)
    .every((task) => hasTask(state, task.id));
}
export function campaignObjective(state) {
  if (state.level === 0) return null;
  const tasks = tasksFor(state).filter((task) => !task.optional);
  const next = tasks.find((task) => !hasTask(state, task.id));
  if (!next)
    return state.level === 4
      ? 'Генератор запущен. Возвращайся к выходу.'
      : 'Все данные собраны. Открой лестницу и спускайся.';
  if (state.level === 1 && state.completed.filter((id) => id.startsWith('file')).length < 3)
    return `Собери карточки архива — ${state.completed.filter((id) => id.startsWith('file')).length}/3.`;
  if (state.level === 2 && !hasTask(state, 'valveNote'))
    return 'Найди инструкцию в комнате отдыха.';
  return next.label + '.';
}
export function completeTask(state, id) {
  const task = tasksFor(state).find((item) => item.id === id);
  if (!task || hasTask(state, id)) return { ok: false, message: 'Уже выполнено.' };
  if (task.requires?.some((required) => !hasTask(state, required)))
    return { ok: false, message: 'Сначала собери необходимые предметы. Загляни в журнал.' };
  if (task.kind === 'valve') {
    if (!hasTask(state, 'valveNote'))
      return { ok: false, message: 'Сначала прочитай инструкцию в комнате отдыха.' };
    const order = state.completed.filter((id) => ['blue', 'red', 'gold'].includes(id)).length;
    if (task.order !== order) {
      state.completed = state.completed.filter((id) => !['blue', 'red', 'gold'].includes(id));
      return {
        ok: false,
        alarm: true,
        message: 'Неверный порядок. Давление снова растёт. Начни с синего.',
      };
    }
  }
  state.completed.push(id);
  if (task.id === 'generator') state.escapeRemaining = 180;
  if (task.optional) state.echoes = Array.from(new Set([...state.echoes, state.level]));
  return {
    ok: true,
    message: task.optional
      ? 'Кассета добавлена в журнал.'
      : task.label.replace(/^(Взять|Закрыть|Прочитать|Забрать)/, 'Готово —'),
    note: task.note,
    title: task.label,
  };
}
export function nextFloor(state) {
  if (!floorReady(state) || state.level >= levels.length - 1) return null;
  return {
    ...state,
    level: state.level + 1,
    x: 4.5 * 1.6,
    z: 8.7 * 1.6,
    yaw: Math.PI / 2,
    pitch: 0,
    stamina: 100,
    battery: Math.max(60, state.battery),
    fuse: false,
    power: true,
    key: true,
    doorOpen: true,
    code: false,
    notes: [],
    completed: [],
    escapeRemaining: 0,
    crouch: false,
  };
}
export function dailySeed(date = new Date()) {
  return Number(date.toISOString().slice(0, 10).replaceAll('-', ''));
}
export function readRecords(raw) {
  try {
    const data = JSON.parse(raw);
    return {
      unlocked: Math.max(0, Math.min(4, Number(data.unlocked) || 0)),
      wins: Math.max(0, Number(data.wins) || 0),
      best: data.best && typeof data.best === 'object' ? data.best : {},
    };
  } catch {
    return { unlocked: 0, wins: 0, best: {} };
  }
}
