import { test } from "node:test";
import assert from "node:assert/strict";
import { ageAt, ageInDays, band, clockLabel } from "../src/age.js";

const NOW = Date.parse("2031-03-12T15:00:00Z");
const daysAgo = (n) => new Date(NOW - n * 86_400_000).toISOString();

test("age is measured from their last contact, not ours", () => {
  const rec = { createdAt: daysAgo(400), lastInboundAt: daysAgo(1) };
  assert.equal(band(rec, NOW), "fresh");
});

test("falls back to creation when they have never replied", () => {
  assert.equal(ageAt({ createdAt: daysAgo(3) }), Date.parse(daysAgo(3)));
  assert.equal(band({ createdAt: daysAgo(3) }, NOW), "fresh");
});

test("bands at the documented thresholds", () => {
  assert.equal(band({ createdAt: daysAgo(13) }, NOW), "fresh");
  assert.equal(band({ createdAt: daysAgo(20) }, NOW), "aging");
  assert.equal(band({ createdAt: daysAgo(60) }, NOW), "stale");
  assert.equal(band({ createdAt: daysAgo(200) }, NOW), "cold");
});

test("no usable date bands LAST, not first", () => {
  // unknown age is not newness; defaulting it to fresh buries the records
  // nobody has looked at
  assert.equal(band({}, NOW), "cold");
  assert.equal(band({ createdAt: "not a date" }, NOW), "cold");
  assert.equal(ageInDays({}, NOW), null);
});

test("a future date does not go negative", () => {
  assert.equal(ageInDays({ createdAt: daysAgo(-5) }, NOW), 0);
});

test("clock reads hours then days", () => {
  assert.equal(clockLabel(6), "6h");
  assert.equal(clockLabel(47), "47h");
  assert.equal(clockLabel(48), "2d");
  assert.equal(clockLabel(-4), "4h", "magnitude only; direction is the caller's");
});

test("bands are configurable", () => {
  const bands = [{ name: "hot", maxDays: 1 }, { name: "rest", maxDays: Infinity }];
  assert.equal(band({ createdAt: daysAgo(0.5) }, NOW, { bands }), "hot");
  assert.equal(band({ createdAt: daysAgo(2) }, NOW, { bands }), "rest");
});
