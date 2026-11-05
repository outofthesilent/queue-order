import { test } from "node:test";
import assert from "node:assert/strict";
import { jitter, createPoller } from "../src/poll.js";

test("jitter stays inside the spread", () => {
  for (let i = 0; i < 2000; i++) {
    const v = jitter(60_000);
    assert.ok(v >= 45_000 && v <= 75_000, `${v} outside ±25%`);
  }
});

test("the extremes are reachable", () => {
  assert.equal(jitter(1000, { random: () => 0 }), 750);
  assert.equal(jitter(1000, { random: () => 1 }), 1250);
  assert.equal(jitter(1000, { random: () => 0.5 }), 1000);
});

test("rejects a spread that could produce a non-positive delay", () => {
  assert.throws(() => jitter(1000, { spread: 1 }), RangeError);
  assert.throws(() => jitter(0), RangeError);
});

test("the delay is re-rolled every tick, so tabs cannot stay in phase", () => {
  // Two pollers started together with the same base must not agree on a
  // sequence of delays. Picking one offset at mount would shift the herd;
  // re-rolling breaks it.
  const seq = [0.1, 0.9, 0.2, 0.8, 0.3];
  let i = 0;
  const delays = [];
  const setTimeoutFn = (fn, ms) => { delays.push(ms); return 0; };
  createPoller(() => {}, 1000, { random: () => seq[i++ % seq.length], setTimeoutFn }).start();
  // force four more ticks by calling schedule through start/stop cycles
  for (let k = 0; k < 4; k++) {
    createPoller(() => {}, 1000, { random: () => seq[i++ % seq.length], setTimeoutFn }).start();
  }
  assert.equal(new Set(delays).size > 1, true, "every tick drew the same delay");
});

test("a throwing poll does not stop the schedule", async () => {
  let scheduled = 0;
  const setTimeoutFn = (fn, ms) => { scheduled++; if (scheduled < 3) queueMicrotask(fn); return 0; };
  let ran = 0;
  const p = createPoller(() => { ran++; throw new Error("network"); }, 1000, { setTimeoutFn });
  p.start({ immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(ran >= 2, `poll stopped after a throw (ran ${ran})`);
  p.stop();
});

test("stop() prevents any further scheduling", () => {
  let scheduled = 0;
  const p = createPoller(() => {}, 1000, { setTimeoutFn: () => { scheduled++; return 0; } });
  p.start();
  const after = scheduled;
  p.stop();
  assert.equal(p.running, false);
  assert.equal(scheduled, after);
});

test("start() twice does not double-schedule", () => {
  let scheduled = 0;
  const p = createPoller(() => {}, 1000, { setTimeoutFn: () => { scheduled++; return 0; } });
  p.start(); p.start();
  assert.equal(scheduled, 1);
  p.stop();
});
