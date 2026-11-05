/**
 * A list that holds still while it is worked.
 *
 * The server re-ranks the queue on a timer and again after every logged
 * outcome. Both are correct. Both are hostile to the person working down the
 * list: the row under their cursor jumps or vanishes mid-call, and logging an
 * outcome removes the record while its detail is still open, leaving nothing
 * to count "next" from.
 *
 * The fix is one list with two orderings. Opening a record freezes the id
 * order; later arrivals join at the bottom; a record that has been handled
 * stays pinned in its slot, marked, until the worker leaves it. The live
 * ordering keeps updating underneath the whole time.
 *
 * The cost is explicit: a frozen list can be wrong. A record handled elsewhere
 * still shows. That trade is deliberate — a stale row costs one wasted call,
 * and a list that reorders under someone's hand costs their place in a
 * conversation with a stranger.
 */

export function createFrozenOrder({ idOf = (r) => r.id } = {}) {
  let frozen = null;
  /** id -> the row as it looked when the order froze */
  let snapshot = new Map();
  const handled = new Set();

  return {
    /** Freeze the current order. Idempotent: a second call while frozen is ignored. */
    open(rows) {
      if (frozen === null) {
        frozen = rows.map(idOf);
        snapshot = new Map(rows.map((r) => [idOf(r), r]));
      }
      return this;
    },

    /** Release the freeze and forget what was handled. */
    close() {
      frozen = null;
      snapshot = new Map();
      handled.clear();
      return this;
    },

    get isFrozen() {
      return frozen !== null;
    },

    /** Mark a record handled. It stays in place until `close()`. */
    markHandled(id) {
      if (frozen !== null) handled.add(id);
      return this;
    },

    isHandled(id) {
      return handled.has(id);
    },

    /**
     * Apply the freeze to a live, freshly ranked list.
     *
     * Rows that were present when it froze keep their slot. Rows that have
     * since left the live list are re-inserted in place, flagged `missing`,
     * so a handled record does not disappear from under the worker. New rows
     * land after everything frozen, in live order.
     */
    apply(liveRows) {
      if (frozen === null) return liveRows.map((row) => ({ row, handled: false, missing: false }));

      const byId = new Map(liveRows.map((r) => [idOf(r), r]));
      const out = [];

      for (const id of frozen) {
        const row = byId.get(id);
        if (row) {
          out.push({ row, handled: handled.has(id), missing: false });
          byId.delete(id);
        } else if (handled.has(id)) {
          // The server dropped it on the outcome, but the worker is still
          // looking at this list. Render what it looked like when we froze,
          // not an empty stub.
          out.push({ row: snapshot.get(id), handled: true, missing: true });
        }
      }
      for (const row of liveRows) {
        if (byId.has(idOf(row))) out.push({ row, handled: false, missing: false });
      }
      return out;
    },

    /**
     * The record to select after finishing `id`: the next one down that is not
     * already handled. Returns null at the end of the list, which the caller
     * should treat as "close and go back", not as an error.
     */
    next(liveRows, id) {
      const list = this.apply(liveRows);
      const i = list.findIndex((e) => idOf(e.row) === id);
      if (i === -1) return null;
      for (let j = i + 1; j < list.length; j++) {
        if (!list[j].handled && !list[j].missing) return list[j].row;
      }
      return null;
    },
  };
}
