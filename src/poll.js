/**
 * A poll schedule that will not synchronise.
 *
 * Every open tab mounts the same hooks at the same moment and stays in phase.
 * A handful of reasonable queries then arrive as one self-synchronised herd
 * against a small database, and the load spikes on a period nobody chose.
 *
 * Picking one random offset at mount does not fix this — it shifts the herd
 * rather than breaking it, and tabs opened together stay together. The jitter
 * has to be re-rolled on EVERY tick. That changes only the timing and costs
 * nothing in freshness.
 */

/** One jittered interval, in ms. Defaults to ±25%. */
export function jitter(baseMs, { spread = 0.25, random = Math.random } = {}) {
  if (!(baseMs > 0)) throw new RangeError("baseMs must be > 0");
  if (spread < 0 || spread >= 1) throw new RangeError("spread must be in [0, 1)");
  const factor = 1 + (random() * 2 - 1) * spread;
  return Math.round(baseMs * factor);
}

/**
 * A self-rescheduling poller. Re-rolls its delay every tick.
 *
 * `fn` may be async; the next delay is computed after it settles, so a slow
 * response cannot stack calls on top of each other.
 */
export function createPoller(fn, baseMs, { spread = 0.25, random = Math.random, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout } = {}) {
  let handle = null;
  let stopped = true;
  let ticks = 0;

  async function run() {
    if (stopped) return;
    ticks++;
    try {
      await fn();
    } catch {
      // A failing poll must not stop the schedule. The caller surfaces the
      // error; the poller's job is only to keep asking.
    }
    if (!stopped) schedule();
  }

  function schedule() {
    handle = setTimeoutFn(run, jitter(baseMs, { spread, random }));
  }

  return {
    start({ immediate = false } = {}) {
      if (!stopped) return this;
      stopped = false;
      if (immediate) run();
      else schedule();
      return this;
    },
    stop() {
      stopped = true;
      if (handle != null) clearTimeoutFn(handle);
      handle = null;
      return this;
    },
    get running() {
      return !stopped;
    },
    get ticks() {
      return ticks;
    },
  };
}
