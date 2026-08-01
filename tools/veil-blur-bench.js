/**
 * Does the hero-stage veil cost more when the surface under it repaints?
 *
 * Today the veil's three stacked `backdrop-filter` layers sample a static
 * `<img>`, so the compositor blurs once and reuses the result. #15 Axis 1
 * proposes making the 3D model a third plate, which would put a canvas that
 * repaints every frame under those same three layers. This measures that.
 *
 * Run it against a running dev build, on a hero detail page (Locker or Foundry,
 * either mounts `HeroDetailFrame`):
 *
 *   GRIMOIRE_DEV_SLOT=3 pnpm dev
 *   GRIMOIRE_DEV_SLOT=3 node scripts/dev-driver.mjs eval "location.hash='#/locker?hero=Mina'"
 *   GRIMOIRE_DEV_SLOT=3 node scripts/dev-driver.mjs evalfile tools/veil-blur-bench.js
 *   # roughly a minute later
 *   GRIMOIRE_DEV_SLOT=3 node scripts/dev-driver.mjs eval "JSON.stringify(window.__blurbench,null,1)"
 *
 * It parks its result on `window.__blurbench` rather than returning it because
 * the driver's CDP calls time out at 20s and a full sweep takes about a minute.
 *
 * READ THE POSITIVE CONTROL FIRST. Condition F quadruples the blur radii over
 * the same repainting canvas. If F does not cost measurably more than B, this
 * harness could not see blur cost on that machine and the rest of the numbers
 * say nothing about it. That is exactly what happened on the 2026-07-30 run
 * (see `docs/locker-deep-dive.md`, Axis 1): every condition sat at 10-11 ms,
 * bounded by vsync and the main-thread canvas paint rather than by the
 * compositor. A machine whose ceiling is lower than the blur's cost, which is
 * the low-end GPU the risk register asks about, is where this starts to read.
 */
window.__blurbench = { status: 'running' };
(async () => {
  const stage = document.querySelector('div.animate-hero-zoom-in');
  const veil = [...document.querySelectorAll('div[aria-hidden]')].find(
    (d) => d.className.includes('inset-y-0') && d.className.includes('left-0')
  );
  if (!stage || !veil) {
    window.__blurbench = { status: 'error', error: 'stage or veil not found; open a hero page' };
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const rect = stage.getBoundingClientRect();

  // Let the browser resolve the clear zone rather than recomputing the clamp.
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;visibility:hidden;width:var(--hero-stage-clear-zone-start)';
  veil.parentElement.appendChild(probe);
  const clearZonePx = probe.getBoundingClientRect().width;
  probe.remove();

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;top:0;bottom:0;z-index:1;pointer-events:none';
  const ctx = canvas.getContext('2d');
  let hue = 0;
  // Deliberately heavier than an idle three.js scene, so the plate's repaint
  // cost is an upper bound rather than a best case.
  const STROKES = 6000;

  function paint() {
    const w = canvas.width;
    const h = canvas.height;
    hue = (hue + 3) % 360;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `hsl(${hue},60%,35%)`);
    g.addColorStop(1, `hsl(${(hue + 120) % 360},60%,15%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    for (let i = 0; i < STROKES; i += 1) {
      const x = (i * 37 + hue * 4) % w;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 40, h);
    }
    ctx.stroke();
  }

  /** `full` spans the stage so the veil samples it; `clear` starts at the clear
   *  zone so the veil samples the solid `bg-primary` it samples today. */
  function placeCanvas(mode) {
    const leftCss = mode === 'clear' ? clearZonePx : 0;
    const widthCss = Math.max(1, rect.width - leftCss);
    canvas.style.left = `${leftCss}px`;
    canvas.style.width = `${widthCss}px`;
    canvas.width = Math.round(widthCss * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }

  const FRAMES = 280;
  const WARMUP = 40;

  function sample() {
    return new Promise((resolve) => {
      const deltas = [];
      let last = performance.now();
      function tick(now) {
        deltas.push(now - last);
        last = now;
        if (canvas.isConnected) paint();
        if (deltas.length >= FRAMES) resolve(deltas.slice(WARMUP));
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function stats(deltas) {
    const sorted = [...deltas].sort((a, b) => a - b);
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    return {
      meanMs: Number(mean.toFixed(2)),
      medianMs: Number(sorted[Math.floor(sorted.length / 2)].toFixed(2)),
      p95Ms: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2)),
      fps: Number((1000 / mean).toFixed(1)),
    };
  }

  const layers = [...veil.children].filter((c) => (c.style.backdropFilter || '').includes('blur'));
  const original = layers.map((l) => l.style.backdropFilter);
  const results = {};

  async function run(label, setup, teardown) {
    setup();
    await new Promise((r) => setTimeout(r, 300));
    results[label] = stats(await sample());
    teardown();
    await new Promise((r) => setTimeout(r, 200));
  }

  // A. The control: today's static <img> plate under three blur layers.
  await run(
    'A_staticPlate_3layers',
    () => {},
    () => {}
  );
  // B. The naive proposal: a repainting plate under all three.
  await run(
    'B_canvasFull_3layers',
    () => {
      placeCanvas('full');
      stage.appendChild(canvas);
    },
    () => canvas.remove()
  );
  // C. Same canvas, no veil. Isolates the canvas's own cost.
  await run(
    'C_canvasFull_noVeil',
    () => {
      placeCanvas('full');
      stage.appendChild(canvas);
      veil.style.display = 'none';
    },
    () => {
      canvas.remove();
      veil.style.display = '';
    }
  );
  // D. Fallback ladder rung one: one blur layer instead of three.
  await run(
    'D_canvasFull_1layer',
    () => {
      placeCanvas('full');
      stage.appendChild(canvas);
      layers.slice(1).forEach((l) => {
        l.style.display = 'none';
      });
    },
    () => {
      canvas.remove();
      layers.forEach((l) => {
        l.style.display = '';
      });
    }
  );
  // E. The compositional fix: frame the model right of the clear zone.
  await run(
    'E_canvasClearZone_3layers',
    () => {
      placeCanvas('clear');
      stage.appendChild(canvas);
    },
    () => canvas.remove()
  );
  // F. Positive control. Read this before reading anything above.
  await run(
    'F_canvasFull_3layers_4xBlur',
    () => {
      placeCanvas('full');
      stage.appendChild(canvas);
      layers.forEach((l, i) => {
        const px = [192, 96, 40][i];
        const filter = i === 0 ? `blur(${px}px) saturate(135%)` : `blur(${px}px)`;
        l.style.backdropFilter = filter;
        l.style.webkitBackdropFilter = filter;
      });
    },
    () => {
      canvas.remove();
      layers.forEach((l, i) => {
        l.style.backdropFilter = original[i];
        l.style.webkitBackdropFilter = original[i];
      });
    }
  );

  layers.forEach((l, i) => {
    l.style.backdropFilter = original[i];
    l.style.webkitBackdropFilter = original[i];
  });

  window.__blurbench = {
    status: 'done',
    dpr,
    stage: { w: Math.round(rect.width), h: Math.round(rect.height) },
    clearZonePx: Math.round(clearZonePx),
    canvasPx: {
      full: Math.round(rect.width * dpr),
      clear: Math.round((rect.width - clearZonePx) * dpr),
    },
    strokesPerFrame: STROKES,
    framesPerSample: FRAMES - WARMUP,
    results,
  };
})().catch((e) => {
  window.__blurbench = { status: 'error', error: String(e) };
});
'started';
