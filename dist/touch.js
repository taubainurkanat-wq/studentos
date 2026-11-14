// Independent pointer ownership allows moving, looking and pressing actions together.
export function bindTouch({
  canvas,
  joystick,
  stick,
  active,
  look,
  settings,
  onChange,
  onInteract,
}) {
  const state = {
    moveX: 0,
    moveZ: 0,
    stickId: null,
    lookId: null,
    origin: null,
    last: null,
    travel: 0,
  };
  const reset = () => {
    state.moveX = 0;
    state.moveZ = 0;
    state.stickId = null;
    state.lookId = null;
    state.origin = null;
    state.last = null;
    stick.style.transform = '';
    joystick.classList.remove('engaged');
    joystick.style.left = '';
    joystick.style.top = '';
    onChange(0, 0);
  };
  function move(event) {
    if (event.pointerId === state.stickId) {
      const radius = 52;
      let dx = event.clientX - state.origin.x,
        dy = event.clientY - state.origin.y;
      const length = Math.hypot(dx, dy),
        limit = Math.max(1, length / radius);
      dx /= limit;
      dy /= limit;
      const deadzone = 5;
      const scale = length < deadzone ? 0 : 1 / radius;
      state.moveX = Math.max(-1,Math.min(1,dx * scale));
      state.moveZ = Math.max(-1,Math.min(1,-dy * scale));
      onChange(state.moveX, state.moveZ);
      stick.style.transform = `translate(${dx}px,${dy}px)`;
    } else if (event.pointerId === state.lookId && state.last) {
      const dx = event.clientX - state.last.x,
        dy = event.clientY - state.last.y;
      state.travel += Math.hypot(dx, dy);
      look(dx * 0.8, dy * 0.65);
      state.last = { x: event.clientX, y: event.clientY };
    }
  }
  function down(event) {
    if (event.pointerType === 'mouse' || !active()) return;
    if (event.clientX < innerWidth * 0.43 && state.stickId === null) {
      state.stickId = event.pointerId;
      state.origin = { x: event.clientX, y: event.clientY };
      joystick.style.left = `${event.clientX - 65}px`;
      joystick.style.top = `${event.clientY - 65}px`;
      joystick.classList.add('engaged');
    } else if (state.lookId === null) {
      state.lookId = event.pointerId;
      state.last = { x: event.clientX, y: event.clientY };
      state.travel = 0;
    }
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    move(event);
  }
  function up(event) {
    if (event.pointerId === state.stickId) {
      state.stickId = null;
      state.moveX = 0;
      state.moveZ = 0;
      onChange(0, 0);
      stick.style.transform = '';
      joystick.classList.remove('engaged');
      joystick.style.left = '';
      joystick.style.top = '';
    }
    if (event.pointerId === state.lookId) {
      if (event.type === 'pointerup' && state.travel < 7 && settings.tapInteract) onInteract();
      state.lookId = null;
      state.last = null;
    }
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
    canvas.addEventListener(event, up);
  return { reset };
}
