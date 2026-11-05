import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrozenOrder } from "../src/frozen.js";

const rows = (...ids) => ids.map((id) => ({ id }));
const ids = (list) => list.map((e) => e.row.id);

test("an unopened list passes the live order straight through", () => {
  const f = createFrozenOrder();
  assert.deepEqual(ids(f.apply(rows("a", "b", "c"))), ["a", "b", "c"]);
});

test("the order holds after the server re-ranks", () => {
  const f = createFrozenOrder().open(rows("a", "b", "c"));
  assert.deepEqual(ids(f.apply(rows("c", "b", "a"))), ["a", "b", "c"]);
});

test("later arrivals join at the bottom", () => {
  const f = createFrozenOrder().open(rows("a", "b"));
  assert.deepEqual(ids(f.apply(rows("z", "a", "b"))), ["a", "b", "z"]);
});

test("a handled record stays in its slot after it leaves the live list", () => {
  const f = createFrozenOrder().open(rows("a", "b", "c"));
  f.markHandled("b");
  const out = f.apply(rows("a", "c")); // the server dropped b on the outcome
  assert.deepEqual(ids(out), ["a", "b", "c"]);
  assert.equal(out[1].handled, true);
  assert.equal(out[1].missing, true);
});

test("an unhandled record that leaves the live list does disappear", () => {
  const f = createFrozenOrder().open(rows("a", "b", "c"));
  assert.deepEqual(ids(f.apply(rows("a", "c"))), ["a", "c"]);
});

test("next() steps past handled rows", () => {
  const f = createFrozenOrder().open(rows("a", "b", "c", "d"));
  f.markHandled("b");
  f.markHandled("c");
  assert.equal(f.next(rows("a", "d"), "a").id, "d");
});

test("next() returns null at the end rather than wrapping", () => {
  const f = createFrozenOrder().open(rows("a", "b"));
  f.markHandled("b");
  assert.equal(f.next(rows("a"), "a"), null);
});

test("opening twice does not re-freeze", () => {
  const f = createFrozenOrder().open(rows("a", "b"));
  f.open(rows("b", "a"));
  assert.deepEqual(ids(f.apply(rows("b", "a"))), ["a", "b"]);
});

test("close forgets the order and what was handled", () => {
  const f = createFrozenOrder().open(rows("a", "b"));
  f.markHandled("a");
  f.close();
  assert.equal(f.isFrozen, false);
  assert.equal(f.isHandled("a"), false);
  assert.deepEqual(ids(f.apply(rows("b", "a"))), ["b", "a"]);
});

test("marking handled before opening is ignored", () => {
  const f = createFrozenOrder();
  f.markHandled("a");
  assert.equal(f.isHandled("a"), false);
});
