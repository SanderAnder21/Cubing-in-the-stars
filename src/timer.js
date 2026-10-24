// Cronometro: barra espaciadora (compu) y toque en la pantalla (celular).
// Flujo: mantener 0.3 s -> listo -> soltar = arranca; cualquier toque/tecla = para.
// Con inspeccion: un toque corto la inicia (15 s: +2 de 15 a 17 s, DNF despues de 17 s).

export function fmt(ms) {
  if (ms === Infinity) return "DNF";
  const s = ms / 1000;
  if (s < 60) return s.toFixed(2);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

export function createTimer({ pad, display, isInspection, isActive, onDone, onState }) {
  let state = "idle", from = "idle", t0 = 0, tInsp = 0, raf = 0, holdTimer = 0, blockRelease = false;
  let plus = 0, dnf = false;
  const set = (s) => ((state = s), (pad.dataset.state = s), onState?.(s));

  const tick = () => {
    const now = performance.now();
    if (state === "running") display.textContent = fmt(now - t0);
    else if (state === "inspecting" || (from === "inspecting" && (state === "holding" || state === "ready"))) {
      const e = (now - tInsp) / 1000;
      if (state === "inspecting") display.textContent = e < 15 ? String(15 - Math.floor(e)) : e < 17 ? "+2" : "DNF";
      pad.dataset.warn = e >= 12 ? "2" : e >= 8 ? "1" : "0";
    }
    raf = requestAnimationFrame(tick);
  };

  function press() {
    if (!isActive()) return;
    if (state === "running") {
      const ms = Math.round(performance.now() - t0);
      cancelAnimationFrame(raf);
      blockRelease = true;
      set("stopped");
      display.textContent = fmt(dnf ? Infinity : ms + plus * 1000);
      onDone({ timeMs: ms, plus, dnf });
      return;
    }
    from = state === "inspecting" ? "inspecting" : "idle";
    set("holding");
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => state === "holding" && set("ready"), 300);
  }

  function release() {
    if (blockRelease) return void (blockRelease = false);
    clearTimeout(holdTimer);
    const now = performance.now();
    if (state === "ready") {
      plus = 0;
      dnf = false;
      if (from === "inspecting") {
        const e = (now - tInsp) / 1000;
        plus = e >= 15 && e < 17 ? 2 : 0;
        dnf = e >= 17;
      }
      pad.dataset.warn = "0";
      t0 = now;
      set("running");
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    } else if (state === "holding") {
      if (from === "inspecting") set("inspecting");
      else if (isInspection()) {
        tInsp = now;
        set("inspecting");
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      } else set("idle");
    }
  }

  function reset() {
    clearTimeout(holdTimer);
    cancelAnimationFrame(raf);
    pad.dataset.warn = "0";
    set("idle");
  }

  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  addEventListener("keydown", (e) => {
    if (e.code === "Escape") return reset();
    if (e.code !== "Space" || typing(e) || !isActive()) return;
    e.preventDefault();
    if (!e.repeat) press();
  });
  addEventListener("keyup", (e) => {
    if (e.code !== "Space" || typing(e) || !isActive()) return;
    e.preventDefault();
    release();
  });
  pad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pad.setPointerCapture?.(e.pointerId);
    press();
  });
  pad.addEventListener("pointerup", release);
  pad.addEventListener("pointercancel", reset);

  return { reset, get state() { return state; } };
}