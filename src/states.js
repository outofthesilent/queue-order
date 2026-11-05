/**
 * State resolution.
 *
 * A queue row's presentation is decided by a table, not by a chain of
 * conditionals scattered through a component. Two reasons, both learned the
 * expensive way:
 *
 *   1. An unknown state must never fall through to its raw value. A raw enum
 *      on screen looks deliberate, so nobody reports it.
 *   2. Some states REPLACE every other state rather than stacking with them.
 *      That has to be declared, not remembered.
 */

/**
 * Build a resolver from a table.
 *
 * Each entry: { when?, label, tone?, exclusive?, order? }
 *   when       — predicate(record) -> boolean. Omit to match on key alone.
 *   exclusive  — this state replaces all others on the row.
 *   order      — lower sorts first when several match.
 */
export function createResolver(table, { key = "state", fallback } = {}) {
  const entries = Object.entries(table).map(([k, v], i) => ({
    key: k,
    order: v.order ?? i,
    ...v,
  }));

  if (!fallback) {
    throw new Error(
      "createResolver needs a `fallback`. An unresolved state must render as " +
        "something a person will report, never as its raw value."
    );
  }

  return function resolve(record) {
    const matched = entries
      .filter((e) => (e.when ? e.when(record) : record?.[key] === e.key))
      .sort((a, b) => a.order - b.order);

    if (matched.length === 0) {
      return [{ ...fallback, key: "__fallback__", raw: record?.[key] ?? null }];
    }
    const exclusive = matched.find((e) => e.exclusive);
    return exclusive ? [exclusive] : matched;
  };
}

/**
 * Group rows into sections, preserving a declared section order and dropping
 * sections nothing landed in. A section header only draws when the section
 * differs from the row above it.
 */
export function sectionise(rows, { sectionOf, order }) {
  const index = new Map(order.map((s, i) => [s, i]));
  const sorted = [...rows].sort(
    (a, b) => (index.get(sectionOf(a)) ?? 1e9) - (index.get(sectionOf(b)) ?? 1e9)
  );
  const out = [];
  let last;
  for (const row of sorted) {
    const s = sectionOf(row);
    if (s !== last) {
      out.push({ type: "section", section: s });
      last = s;
    }
    out.push({ type: "row", row });
  }
  return out;
}
