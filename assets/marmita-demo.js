// The "Try it right here" demo: a window is dragged with Shift held, the zones
// appear and the window snaps into one. Visitors can take over with the mouse
// (Shift + drag), with the same shortcuts as the app (⌃⌥←/→, ⌃⌥1–3) or with
// the buttons under it on touch screens. The loop resumes after a quiet spell.
(() => {
  const stage = document.querySelector("[data-stage]");

  if (!stage) {
    return;
  }

  const desk = stage.querySelector(".desk");
  const cursor = stage.querySelector(".cursor");
  const keycap = stage.querySelector(".keycap");
  const notes = stage.querySelector("[data-win='notes']");
  const zoneEls = [...stage.querySelectorAll(".zone")];
  const zones = zoneEls.map((el) => ({
    x: Number(el.dataset.x),
    y: Number(el.dataset.y),
    w: Number(el.dataset.w),
    h: Number(el.dataset.h),
  }));
  const home = { x: 20, y: 24, w: 36, h: 46 };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const moveMs = 550;

  let run = 0;
  let hot = -1;
  let current = -1;
  let zonesOn = false;
  let resumeTimer;
  let keycapTimer;

  zoneEls.forEach((el, index) => {
    Object.assign(el.style, toStyle(zones[index]));
  });

  function toStyle(rect) {
    return { left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` };
  }

  function placeWindow(rect) {
    Object.assign(notes.style, toStyle(rect));
    notes.dataset.x = rect.x;
    notes.dataset.y = rect.y;
    notes.dataset.w = rect.w;
    notes.dataset.h = rect.h;
  }

  function getWindowRect() {
    return {
      x: Number(notes.dataset.x),
      y: Number(notes.dataset.y),
      w: Number(notes.dataset.w),
      h: Number(notes.dataset.h),
    };
  }

  function snapTo(index) {
    current = index;
    placeWindow(zones[index]);
  }

  function placeCursor(x, y) {
    cursor.style.left = `${x}%`;
    cursor.style.top = `${y}%`;
  }

  function showKeycap(label, pressed) {
    keycap.textContent = label;
    keycap.classList.add("on");
    keycap.classList.toggle("press", pressed);
  }

  function hideKeycap() {
    keycap.classList.remove("on", "press");
  }

  function flashKeycap(label) {
    clearTimeout(keycapTimer);
    showKeycap(label, true);
    keycapTimer = setTimeout(hideKeycap, 700);
  }

  function setZones(on) {
    zonesOn = on;
    stage.classList.toggle("zones-on", on);

    if (!on) {
      setHot(-1);
    }
  }

  function setHot(index) {
    if (index === hot) {
      return;
    }

    hot = index;
    zoneEls.forEach((el, i) => el.classList.toggle("hot", i === index));
  }

  function findZone(px, py) {
    const inside = zones.findIndex((z) => px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h);

    if (inside !== -1) {
      return inside;
    }

    let best = -1;
    let bestDistance = Infinity;

    zones.forEach((z, i) => {
      const distance = Math.hypot(
        Math.max(z.x - px, 0, px - (z.x + z.w)),
        Math.max(z.y - py, 0, py - (z.y + z.h)),
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });

    return best;
  }

  // While the zones are up in the scripted loop, the highlight follows the
  // cursor's real position, including mid-transition.
  function trackHot() {
    if (zonesOn && !stage.classList.contains("user")) {
      const deskBox = desk.getBoundingClientRect();
      const cursorBox = cursor.getBoundingClientRect();

      setHot(findZone(
        ((cursorBox.left - deskBox.left) / deskBox.width) * 100,
        ((cursorBox.top - deskBox.top) / deskBox.height) * 100,
      ));
    }

    requestAnimationFrame(trackHot);
  }

  function sleep(ms, token) {
    return new Promise((resolve, reject) => {
      setTimeout(() => (token === run ? resolve() : reject(new Error("stopped"))), ms);
    });
  }

  async function dragTo(target, token) {
    const start = getWindowRect();
    const grab = { x: start.x + start.w * 0.5, y: start.y + 2.4 };
    const offset = { x: grab.x - start.x, y: grab.y - start.y };

    placeCursor(grab.x, grab.y);
    await sleep(moveMs + 150, token);

    notes.classList.add("follow");
    const nudge = { ...start, x: start.x + 3, y: start.y - 2 };
    placeWindow(nudge);
    placeCursor(nudge.x + offset.x, nudge.y + offset.y);
    await sleep(moveMs, token);

    showKeycap("⇧ Shift", true);
    setZones(true);
    await sleep(300, token);

    const zone = zones[target];
    const aim = { x: zone.x + zone.w * 0.5, y: zone.y + zone.h * 0.4 };
    placeWindow({ ...start, x: aim.x - offset.x, y: aim.y - offset.y });
    placeCursor(aim.x, aim.y);
    await sleep(moveMs + 250, token);

    notes.classList.remove("follow");
    snapTo(target);
    hideKeycap();
    setZones(false);
    await sleep(1500, token);
  }

  async function loop() {
    const token = ++run;

    stage.classList.remove("user");

    try {
      for (;;) {
        await dragTo(1, token);
        await dragTo(2, token);
        await dragTo(0, token);
        current = -1;
        placeWindow(home);
        placeCursor(home.x + home.w * 0.5, home.y + 2.4);
        await sleep(moveMs + 600, token);
      }
    } catch {
      // Stopped because the visitor took over.
    }
  }

  function takeOver() {
    run += 1;
    clearTimeout(resumeTimer);
    notes.classList.remove("follow");
    hideKeycap();
    setZones(false);
    stage.classList.add("user");
  }

  function scheduleResume() {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(loop, 9000);
  }

  function step(by) {
    const from = current === -1 ? (by > 0 ? -1 : 0) : current;

    snapTo((from + by + zones.length) % zones.length);
  }

  // Mouse and touch.
  let drag = null;

  function getDeskPoint(event) {
    const box = desk.getBoundingClientRect();

    return {
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    };
  }

  function updateDragZones(shiftHeld) {
    if (!drag) {
      return;
    }

    const show = shiftHeld || drag.touch;

    if (shiftHeld) {
      showKeycap("⇧ Shift", true);
    } else {
      hideKeycap();
    }

    if (show !== zonesOn) {
      setZones(show);
    }

    if (show) {
      setHot(findZone(drag.last.x, drag.last.y));
    }
  }

  notes.querySelector(".bar").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    takeOver();

    const point = getDeskPoint(event);
    const rect = getWindowRect();

    drag = { dx: point.x - rect.x, dy: point.y - rect.y, rect, last: point, touch: event.pointerType !== "mouse" };
    notes.classList.add("dragging");
    notes.setPointerCapture(event.pointerId);
    updateDragZones(event.shiftKey);
  });

  notes.addEventListener("pointermove", (event) => {
    if (!drag) {
      return;
    }

    const point = getDeskPoint(event);
    drag.last = point;
    current = -1;
    placeWindow({
      ...drag.rect,
      x: Math.min(Math.max(point.x - drag.dx, -drag.rect.w * 0.6), 100 - drag.rect.w * 0.4),
      y: Math.min(Math.max(point.y - drag.dy, 0), 92),
    });
    updateDragZones(event.shiftKey);
  });

  function endDrag() {
    if (!drag) {
      return;
    }

    notes.classList.remove("dragging");

    if (zonesOn && hot !== -1) {
      snapTo(hot);
    }

    drag = null;
    hideKeycap();
    setZones(false);
    scheduleResume();
  }

  notes.addEventListener("pointerup", endDrag);
  notes.addEventListener("pointercancel", endDrag);

  // The app's own shortcuts, while the demo is on screen.
  let onScreen = false;

  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
  }, { threshold: 0.3 }).observe(stage);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Shift") {
      updateDragZones(true);

      return;
    }

    if (!onScreen || !event.ctrlKey || !event.altKey || event.metaKey) {
      return;
    }

    const digit = /^Digit([1-3])$/.exec(event.code);

    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      takeOver();
      step(event.code === "ArrowRight" ? 1 : -1);
      flashKeycap(event.code === "ArrowRight" ? "⌃ ⌥ →" : "⌃ ⌥ ←");
      scheduleResume();
    } else if (digit) {
      event.preventDefault();
      takeOver();
      snapTo(Number(digit[1]) - 1);
      flashKeycap(`⌃ ⌥ ${digit[1]}`);
      scheduleResume();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "Shift") {
      updateDragZones(false);
    }
  });

  document.querySelectorAll(".pad button").forEach((button) => {
    button.addEventListener("click", () => {
      takeOver();

      if (button.dataset.step) {
        step(Number(button.dataset.step));
      } else {
        snapTo(Number(button.dataset.zone));
      }

      scheduleResume();
    });
  });

  placeWindow(home);
  placeCursor(home.x + home.w * 0.5 + 6, home.y + 30);

  if (reduceMotion) {
    snapTo(1);

    return;
  }

  requestAnimationFrame(trackHot);
  loop();
})();
