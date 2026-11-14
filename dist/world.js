import * as THREE from './vendor/three.module.js';
import { CELL, WIDTH, HEIGHT } from './core.js';
import { levels, tasksFor, hasTask } from './campaign.js';

export function makeWorld(canvas, grid, settings, floor = 0, existingRenderer = null) {
  const renderer =
    existingRenderer ||
    new THREE.WebGLRenderer({
      canvas,
      antialias: settings.quality === 'high',
      powerPreference: 'high-performance',
    });
  renderer.setClearColor(0x070d0c);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(levels[floor].fog, floor === 3 ? 0.08 : 0.058);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.06, 65);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0x9dbdb1, 0x192219, 0.52));
  const ambient = new THREE.AmbientLight(0xbac6a0, 0.15);
  scene.add(ambient);
  let seed = 1313;
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function texture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = type === 'wall' ? '#9e9d89' : type === 'floor' ? '#51574a' : '#74786b';
    ctx.fillRect(0, 0, 256, 256);
    if (type === 'wall') {
      ctx.fillStyle = '#4b6054';
      ctx.fillRect(0, 126, 256, 130);
      ctx.fillStyle = '#394a40';
      ctx.fillRect(0, 124, 256, 5);
      for (let i = 0; i < 190; i++) {
        const x = random() * 256,
          y = random() * 256,
          w = 2 + random() * 32,
          h = 1 + random() * 10;
        ctx.fillStyle = y > 130 ? '#a8a38a55' : '#5c65544a';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y - 2);
        ctx.lineTo(x + w * 0.8, y + h);
        ctx.lineTo(x - 3, y + h * 0.3);
        ctx.fill();
      }
      ctx.fillStyle = '#182c2670';
      ctx.fillRect(0, 238, 256, 18);
      for (let i = 0; i < 28; i++) {
        ctx.fillStyle = '#232b2230';
        ctx.fillRect(random() * 256, 128, 1 + random() * 4, random() * 100);
      }
    }
    if (type === 'floor') {
      ctx.strokeStyle = '#151e18';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 256, 256);
      ctx.strokeStyle = '#8b8c7040';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, 248, 248);
      ctx.strokeStyle = '#222a2060';
      ctx.beginPath();
      ctx.moveTo(0, 80);
      ctx.lineTo(40, 92);
      ctx.lineTo(64, 135);
      ctx.stroke();
    }
    const data = ctx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < data.data.length; i += 4) {
      const noise = (random() - 0.5) * 25;
      for (let c = 0; c < 3; c++) data.data[i + c] += noise;
    }
    ctx.putImageData(data, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  const materials = {
    wall: new THREE.MeshStandardMaterial({ map: texture('wall'), roughness: 0.97 }),
    floor: new THREE.MeshStandardMaterial({ map: texture('floor'), roughness: 0.75 }),
    ceiling: new THREE.MeshLambertMaterial({ map: texture('ceiling') }),
    wood: new THREE.MeshStandardMaterial({ color: 0x3e3528, roughness: 0.92 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x101b17, roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x5b6359, roughness: 0.6, metalness: 0.4 }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xc8a258,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0x443009,
      emissiveIntensity: 0.3,
    }),
    paper: new THREE.MeshStandardMaterial({ color: 0xc8c5a5, roughness: 1 }),
  };
  materials.wall.color.setHex(levels[floor].color);
  materials.floor.color.setHex(levels[floor].color);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function box(x, y, z, w, h, d, material = materials.wood, parent = scene) {
    const mesh = new THREE.Mesh(boxGeo, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }
  let floors = [],
    walls = [];
  for (let z = 0; z < HEIGHT; z++)
    for (let x = 0; x < WIDTH; x++) {
      if (grid[z][x] === 0) floors.push([x, z]);
      else if (
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dz]) => grid[z + dz]?.[x + dx] === 0)
      )
        walls.push([x, z]);
    }
  function instances(positions, height, y, material) {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(CELL, height, CELL),
      material,
      positions.length,
    );
    const matrix = new THREE.Matrix4();
    positions.forEach(([x, z], i) => {
      matrix.makeTranslation((x + 0.5) * CELL, y, (z + 0.5) * CELL);
      mesh.setMatrixAt(i, matrix);
    });
    scene.add(mesh);
  }
  instances(walls, 3.2, 1.6, materials.wall);
  instances(floors, 0.08, -0.04, materials.floor);
  instances(floors, 0.08, 3.24, materials.ceiling);
  // Door slabs, frames and printed signs all belong to the scene.
  function sign(
    text,
    x,
    y,
    z,
    width = 1,
    height = 0.35,
    rotation = 0,
    bg = '#252b23',
    fg = '#c9cab3',
  ) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#aea99055';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 496, 240);
    ctx.fillStyle = fg;
    ctx.font = 'bold 62px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((line, i) =>
      ctx.fillText(line, 256, 128 + (i - (lines.length - 1) / 2) * 75, 470),
    );
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: tex, transparent: false, side: THREE.DoubleSide }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    scene.add(mesh);
    return mesh;
  }
  const lamps = [];
  function lamp(x, z, color = 0x97aa89, strength = 5) {
    box(x, 3.08, z, 1.1, 0.08, 0.25, materials.dark);
    const mat = new THREE.MeshBasicMaterial({ color });
    box(x, 3.015, z, 0.92, 0.02, 0.13, mat);
    const light = new THREE.PointLight(color, strength, 8, 1.6);
    light.position.set(x, 2.76, z);
    scene.add(light);
    lamps.push({ light, mat, strength });
  }
  for (const x of [4, 10, 17, 23]) lamp(x * CELL, 9 * CELL, 0x97b09c, x === 17 ? 2 : 6);
  lamp(12.5 * CELL, 4.8 * CELL, 0x6aaf88, 5);
  lamp(5.5 * CELL, 4.5 * CELL, 0xc4ad78, 2);
  lamp(21.5 * CELL, 4.8 * CELL, 0x9eb7ba, 1);
  // Narrow pipes run along the ceiling and make distance legible.
  for (const z of [8.08, 9.92])
    box(13 * CELL, 2.85, z * CELL, 23 * CELL, 0.065, 0.065, materials.metal);
  for (const x of [3, 9, 15, 23]) {
    box(x * CELL, 0.45, 7.99 * CELL, 1.2, 0.65, 0.14, materials.metal);
    for (let i = 0; i < 9; i++)
      box(x * CELL - 0.5 + i * 0.125, 0.45, 8.05 * CELL, 0.04, 0.6, 0.12, materials.dark);
  }
  function frame(gx, gz, label, front = true) {
    const x = (gx + 0.5) * CELL,
      z = (gz + (front ? 1 : 0)) * CELL;
    box(x - 0.71, 1.35, z, 0.12, 2.7, 0.18, materials.wood);
    box(x + 0.71, 1.35, z, 0.12, 2.7, 0.18, materials.wood);
    box(x, 2.66, z, 1.5, 0.14, 0.18, materials.wood);
    sign(label, x, 2.94, z + (front ? 0.04 : -0.04), 1.2, 0.3, front ? 0 : Math.PI);
  }
  frame(5, 7, ['ЩИТОВАЯ', 'ТЕРМИНАЛ', 'ВЕНТИЛЬ З', 'ЧАСТОТЫ', 'ГЕНЕРАТОР'][floor]);
  frame(12, 7, 'ТИХАЯ КОМНАТА');
  frame(21, 7, ['13', 'АРХИВ C', 'ВЕНТИЛЬ К', 'АККУМУЛЯТОР', 'МОДУЛЬ B'][floor]);
  frame(6, 10, 'КЛАДОВАЯ', false);
  frame(18, 10, 'КОМНАТА ОТДЫХА', false);
  for (const x of [3, 9, 15, 17, 23]) {
    const z = 7.99 * CELL;
    box((x + 0.5) * CELL, 1.3, z, 1.15, 2.6, 0.14, materials.wood);
    sign(String(x + 97), (x + 0.5) * CELL, 2.1, z + 0.08, 0.35, 0.22);
    box((x + 0.5) * CELL + 0.4, 1.1, z + 0.11, 0.12, 0.04, 0.06, materials.gold);
  }
  const door = box(21.5 * CELL, 1.32, 7.65 * CELL, 1.45, 2.64, 0.13, materials.wood);
  sign('НЕ ОТКРЫВАТЬ', 21.5 * CELL, 1.9, 7.7 * CELL, 0.9, 0.25);
  const exitDoor = box(1.1 * CELL, 1.4, 9 * CELL, 0.15, 2.8, 2.6, materials.dark);
  sign(
    floor === 4 ? 'ВЫХОД' : 'ЛЕСТНИЦА',
    1.21 * CELL,
    2.5,
    9 * CELL,
    1.1,
    0.35,
    Math.PI / 2,
    '#1f5037',
    '#b7edc9',
  );
  const exitLight = new THREE.PointLight(0x63c58d, 2, 5);
  exitLight.position.set(2.2 * CELL, 2.4, 9 * CELL);
  scene.add(exitLight);
  box(1.25 * CELL, 1.35, 8.1 * CELL, 0.2, 0.5, 0.3, materials.metal);
  sign('••••', 1.37 * CELL, 1.4, 8.1 * CELL, 0.23, 0.14, Math.PI / 2);
  const panel = box(3.2 * CELL, 1.45, 4.5 * CELL, 0.22, 1.3, 0.9, materials.metal);
  sign('РЕЗЕРВ\n220 В', 3.33 * CELL, 1.55, 4.5 * CELL, 0.65, 0.55, Math.PI / 2);
  const powerLed = box(
    3.35 * CELL,
    1.03,
    4.5 * CELL,
    0.03,
    0.08,
    0.08,
    new THREE.MeshBasicMaterial({ color: 0x993d28 }),
  );
  function desk(x, z) {
    box(x, 0.84, z, 1.75, 0.1, 0.85);
    for (const dx of [-0.74, 0.74])
      for (const dz of [-0.32, 0.32]) box(x + dx, 0.4, z + dz, 0.07, 0.8, 0.07, materials.metal);
  }
  desk(7 * CELL, 13.4 * CELL);
  desk(18 * CELL, 13.6 * CELL);
  desk(21.5 * CELL, 3.9 * CELL);
  box(21.5 * CELL, 0.95, 3.8 * CELL, 0.5, 0.15, 0.27, materials.dark);
  box(21.5 * CELL, 1.06, 3.8 * CELL, 0.57, 0.1, 0.13, materials.dark);
  // Bed and lockers in the safe room.
  box(11.8 * CELL, 0.45, 4 * CELL, 1.05, 0.12, 2.1, materials.metal);
  box(11.8 * CELL, 0.6, 4 * CELL, 1, 0.2, 2, materials.paper);
  box(11.8 * CELL, 0.75, 3.6 * CELL, 0.8, 0.13, 0.5, materials.paper);
  box(14.5 * CELL, 1.1, 4 * CELL, 0.6, 2.2, 1, materials.metal);
  for (const x of [4.2, 8.2]) {
    box(x * CELL, 1.1, 12 * CELL, 0.45, 2.2, 2.5, materials.metal);
    for (const y of [0.4, 1.1, 1.8]) box(x * CELL, y, 12 * CELL, 0.7, 0.06, 2.5, materials.wood);
  }
  sign('СНАЧАЛА\nВЫКЛЮЧИ СВЕТ', 18 * CELL, 2.1, 14.98 * CELL, 1.3, 0.7, Math.PI);
  sign(
    'НОЧНОЙ ДЕЖУРНЫЙ\n02 : 13',
    5.5 * CELL,
    1.8,
    9.98 * CELL,
    1.4,
    0.7,
    Math.PI,
    '#b1ae91',
    '#303a30',
  );
  // Pickups use genuine mesh silhouettes and a small amber light.
  function pickup(type, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 1.05, z);
    scene.add(group);
    if (type === 'key') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 7, 16), materials.gold);
      group.add(ring);
      box(0, -0.13, 0, 0.035, 0.2, 0.035, materials.gold, group);
      box(0.035, -0.22, 0, 0.09, 0.03, 0.035, materials.gold, group);
    } else if (type === 'fuse') {
      box(0, 0, 0, 0.3, 0.13, 0.13, materials.paper, group);
      for (const x of [-0.14, 0.14]) box(x, 0, 0, 0.06, 0.15, 0.15, materials.gold, group);
    } else {
      box(0, 0, 0, 0.32, 0.012, 0.24, materials.paper, group);
    }
    const glow = new THREE.PointLight(0xd4b673, 0.6, 1.8);
    glow.position.y = 0.25;
    group.add(glow);
    return group;
  }
  const pickups = {
    fuse: pickup('fuse', 7 * CELL, 13.4 * CELL),
    key: pickup('key', 3.8 * CELL, 5.5 * CELL),
    diary: pickup('note', 18 * CELL, 13.6 * CELL),
    code: pickup('note', 21.5 * CELL, 4.3 * CELL),
  };
  const warning = sign(
    'ЕСЛИ ТЫ НА 13 ЭТАЖЕ\nПРОЧИТАЙ ЭТО',
    4.5 * CELL,
    1.5,
    9.98 * CELL,
    1,
    0.6,
    Math.PI,
    '#b0a78d',
    '#24382d',
  );
  const objects = [
    {
      id: 'warning',
      label: 'Прочитать объявление',
      x: 4.5 * CELL,
      z: 9.8 * CELL,
      y: 1.5,
      mesh: warning,
    },
    {
      id: 'fuse',
      label: 'Взять предохранитель',
      x: 7 * CELL,
      z: 13.4 * CELL,
      y: 1.05,
      mesh: pickups.fuse,
    },
    {
      id: 'panel',
      label: 'Установить предохранитель',
      x: 3.7 * CELL,
      z: 4.5 * CELL,
      y: 1.45,
      mesh: panel,
    },
    {
      id: 'key',
      label: 'Взять ключ от комнаты 13',
      x: 3.8 * CELL,
      z: 5.5 * CELL,
      y: 1.05,
      mesh: pickups.key,
    },
    {
      id: 'door',
      label: 'Открыть комнату 13',
      x: 21.5 * CELL,
      z: 8.05 * CELL,
      y: 1.35,
      mesh: door,
    },
    {
      id: 'diary',
      label: 'Прочитать записку',
      x: 18 * CELL,
      z: 13.6 * CELL,
      y: 1.05,
      mesh: pickups.diary,
    },
    {
      id: 'code',
      label: 'Прочитать записку у телефона',
      x: 21.5 * CELL,
      z: 4.3 * CELL,
      y: 1.05,
      mesh: pickups.code,
    },
    { id: 'exit', label: 'Открыть лестницу', x: 1.8 * CELL, z: 9 * CELL, y: 1.4, mesh: exitDoor },
  ];
  const monster = new THREE.Group();
  scene.add(monster);
  const skin = new THREE.MeshStandardMaterial({ color: 0x070a09, roughness: 1 });
  const torso = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5, 7), skin);
  torso.position.y = 1;
  monster.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skin);
  head.position.set(0, 1.92, 0);
  head.scale.y = 1.45;
  monster.add(head);
  for (const side of [-1, 1]) {
    box(side * 0.25, 0.35, 0, 0.12, 0.9, 0.15, skin, monster);
    const arm = box(side * 0.34, 1.05, 0, 0.09, 1.22, 0.1, skin, monster);
    arm.rotation.z = side * 0.12;
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.019, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xd1d7ae }),
    );
    eye.position.set(side * 0.065, 1.96, 0.16);
    monster.add(eye);
  }
  // A body-mounted torch provides a diegetic foreground reference.
  const torch = new THREE.Group();
  camera.add(torch);
  scene.add(camera);
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.26, 12), materials.dark);
  housing.rotation.x = Math.PI / 2;
  housing.position.set(0.23, -0.23, -0.3);
  torch.add(housing);
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.04, 12),
    new THREE.MeshBasicMaterial({ color: 0xb8b69b }),
  );
  lens.rotation.y = Math.PI;
  lens.position.set(0.23, -0.23, -0.44);
  torch.add(lens);
  const light = new THREE.SpotLight(0xffe4b1, 38, 22, 0.43, 0.62, 1.5);
  scene.add(light);
  scene.add(light.target);
  const fill = new THREE.PointLight(0xc3d2bd, 0.75, 4.2, 1.3);
  scene.add(fill);
  function resize() {
    const w = innerWidth,
      h = innerHeight;
    renderer.setPixelRatio(
      Math.min(
        devicePixelRatio || 1,
        settings.quality === 'high' ? 1.65 : settings.quality === 'low' ? 0.8 : 1.15,
      ),
    );
    renderer.setSize(w, h, false);
    camera.fov = w < h ? 82 : 70;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  const baseObjects = objects.slice();
  let campaignObjects = [];
  let campaignSignature = '';
  function syncCampaign(state) {
    const signature = state.level + ':' + state.seed + ':' + state.runMode;
    if (campaignSignature !== signature) {
      for (const object of campaignObjects) scene.remove(object.mesh);
      campaignObjects = tasksFor(state).map((task) => {
        let mesh;
        if (task.kind === 'valve') {
          mesh = new THREE.Group();
          mesh.position.set(task.x, 1.1, task.z);
          scene.add(mesh);
          const material = new THREE.MeshStandardMaterial({
            color: task.color,
            metalness: 0.5,
            roughness: 0.55,
          });
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 20), material);
          mesh.add(ring);
          box(0, 0, 0, 0.55, 0.04, 0.05, material, mesh);
          box(0, 0, 0, 0.04, 0.55, 0.05, material, mesh);
          box(0, -0.55, 0, 0.12, 1.1, 0.12, materials.metal, mesh);
          const glow = new THREE.PointLight(task.color, 0.8, 2);
          glow.position.y = 0.5;
          mesh.add(glow);
        } else if (task.kind === 'console' || task.kind === 'radio') {
          mesh = new THREE.Group();
          mesh.position.set(task.x, 0, task.z);
          scene.add(mesh);
          box(0, 0.85, 0, 0.7, 1.7, 0.45, materials.metal, mesh);
          box(
            0,
            1.15,
            0.24,
            0.45,
            0.25,
            0.025,
            new THREE.MeshBasicMaterial({ color: 0x6aa790 }),
            mesh,
          );
        } else mesh = pickup(task.optional ? 'key' : 'note', task.x, task.z);
        return { ...task, mesh };
      });
      campaignSignature = signature;
      objects.splice(
        0,
        objects.length,
        ...(floor === 0 ? baseObjects : baseObjects.filter((o) => o.id === 'exit')),
        ...campaignObjects.map((o) => ({ ...o, id: 'task:' + o.id })),
      );
    }
    for (const item of campaignObjects) {
      const done = hasTask(state, item.id);
      item.mesh.visible =
        !done || item.kind === 'valve' || item.kind === 'console' || item.kind === 'radio';
      if (item.kind === 'valve') item.mesh.rotation.z = done ? Math.PI / 2 : 0;
    }
  }

  return {
    scene,
    camera,
    renderer,
    monster,
    light,
    fill,
    objects,
    pickups,
    lamps,
    resize,
    dispose() {
      scene.traverse((object) => {
        object.geometry?.dispose();
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          if (!material) continue;
          for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
          material.dispose();
        }
      });
    },
    sync(state) {
      syncCampaign(state);
      warning.visible = state.level === 0;
      pickups.fuse.visible = state.level === 0 && !state.fuse;
      pickups.key.visible = state.level === 0 && state.power && !state.key;
      pickups.diary.visible = state.level === 0;
      pickups.code.visible = state.level === 0;
      door.visible = !state.doorOpen;
      powerLed.material.color.setHex(state.power ? 0x81db8b : 0x993d28);
    },
    render(state, time, playing, flashlight, bob = 0) {
      renderer.toneMappingExposure = settings.brightness / 100;
      if (playing) {
        camera.position.set(state.x, (state.crouch ? 0.93 : 1.58) + bob, state.z);
        camera.rotation.set(state.pitch, -state.yaw, 0);
      } else if (!state.started) {
        camera.position.set(18.5 * CELL, 1.56, 9.1 * CELL);
        camera.rotation.set(-0.04, -Math.PI * 0.38, 0);
      }
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      light.position.copy(camera.position);
      light.position.y -= 0.12;
      light.target.position.copy(camera.position).addScaledVector(direction, 5);
      light.intensity = flashlight
        ? 38 * (state.battery < 15 ? 0.76 + Math.sin(time * 28) * 0.18 : 1)
        : 0;
      fill.position.copy(camera.position);
      fill.intensity = flashlight ? 0.8 : 0.32;
      for (let i = 0; i < lamps.length; i++) {
        const l = lamps[i];
        const flicker =
          i === 2 ? (Math.sin(time * 13) * Math.sin(time * 7) > 0.65 ? 0.1 : 0.65) : 1;
        l.light.intensity = l.strength * flicker * (state.power ? 1.45 : 0.65);
        l.mat.color.setScalar(0.7 * flicker);
      }
      for (const [id, mesh] of Object.entries(pickups)) {
        if (id === 'key') mesh.rotation.z = Math.sin(time * 1.5) * 0.1;
      }
      torch.visible = playing;
      renderer.render(scene, camera);
    },
  };
}
