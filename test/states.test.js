import { test } from "node:test";
import assert from "node:assert/strict";
import { createResolver, sectionise } from "../src/states.js";

const fallback = { label: "Needs a look", tone: "warn" };

test("a resolver refuses to be built without a fallback", () => {
  assert.throws(() => createResolver({ a: { label: "A" } }), /fallback/);
});

test("an unknown state never renders its raw value", () => {
  const resolve = createResolver({ replied: { label: "Replied" } }, { fallback });
  const [got] = resolve({ state: "SAME_DAY_MOVE_GHOST" });
  assert.equal(got.label, "Needs a look");
  assert.equal(got.raw, "SAME_DAY_MOVE_GHOST", "kept for logging, not for display");
});

test("an exclusive state replaces everything else", () => {
  const resolve = createResolver(
    {
      sub: { when: (r) => r.sub, label: "Sub pending", exclusive: true },
      trial: { when: (r) => r.trial, label: "Trial" },
      unpaid: { when: (r) => r.unpaid, label: "Unpaid" },
    },
    { fallback }
  );
  const got = resolve({ sub: true, trial: true, unpaid: true });
  assert.equal(got.length, 1);
  assert.equal(got[0].label, "Sub pending");
});

test("non-exclusive states stack in declared order", () => {
  const resolve = createResolver(
    {
      trial: { when: (r) => r.trial, label: "Trial" },
      unpaid: { when: (r) => r.unpaid, label: "Unpaid" },
    },
    { fallback }
  );
  assert.deepEqual(resolve({ trial: true, unpaid: true }).map((s) => s.label), ["Trial", "Unpaid"]);
});

test("sections keep their declared order and drop the empty ones", () => {
  const rows = [{ s: "b" }, { s: "a" }, { s: "b" }];
  const out = sectionise(rows, { sectionOf: (r) => r.s, order: ["a", "b", "c"] });
  assert.deepEqual(
    out.filter((e) => e.type === "section").map((e) => e.section),
    ["a", "b"],
    "c had nothing in it"
  );
});

test("a section header draws once, not per row", () => {
  const rows = [{ s: "a" }, { s: "a" }, { s: "a" }];
  const out = sectionise(rows, { sectionOf: (r) => r.s, order: ["a"] });
  assert.equal(out.filter((e) => e.type === "section").length, 1);
});
