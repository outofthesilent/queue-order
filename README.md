# queue-order

Ordering primitives for a work queue a person reads top-down.

Four problems, each one learned from a queue in production that four
organisations work from every day:

- **Age banding** measured from *their* last contact, not ours
- **State resolution** through a table, where an unknown state can never reach
  the screen as its raw value
- **A list that holds still** while someone works it, even as the server
  re-ranks underneath
- **A poll schedule that cannot synchronise** across tabs

No dependencies, no framework, no opinion about your schema. Pure functions and
two small factories.

```bash
npm install queue-order
```

---

## The list that holds still

This is the one worth reading.

A queue ranked by what is owed re-ranks on a timer, and again after every
logged outcome. Both behaviours are correct. Both are hostile to the person
working down the list:

- the row under their cursor jumps or vanishes mid-call
- logging an outcome removes the record from the queue while its detail panel
  is still open, leaving nothing to count "next" from

The fix is one list with two orderings. Opening a record freezes the id order.
Later arrivals join at the bottom. A record that has been handled stays pinned
in its slot, marked, until the worker leaves it. The live ordering keeps
updating underneath the whole time.

```js
import { createFrozenOrder } from "queue-order";

const order = createFrozenOrder();

// a worker opens a record: freeze
order.open(liveRows);

// the server re-ranks. the rendered list does not move.
order.apply(newlyRankedRows); // -> [{ row, handled, missing }, ...]

// they log an outcome. the row stays where it was, dimmed.
order.markHandled("L-1002");
const next = order.next(newlyRankedRows, "L-1002");

// they leave the record
order.close();
```

**The cost is explicit.** A frozen list can be wrong — a record handled
somewhere else still shows. That trade is deliberate: a stale row costs one
wasted call, and a list that reorders under someone's hand costs their place in
a conversation with a stranger.

A handled row that the server has since dropped is re-inserted from a snapshot
taken at freeze time, flagged `missing`, so it renders with its real data
rather than an empty stub.

---

## Age banding

```js
import { band, clockLabel } from "queue-order";

band({ createdAt, lastInboundAt }, Date.now()); // "fresh" | "aging" | "stale" | "cold"
clockLabel(30);  // "30h"
clockLabel(96);  // "4d"
```

Two decisions in here that are easy to get backwards:

**Age is measured from their last contact, not ours.** A record chased five
times this week is not fresh. A record that answered an hour ago is, however
old the file is.

**No usable date bands _last_, not first.** Unknown age is not newness.
Defaulting it to "fresh" quietly buries the records nobody has ever looked at —
exactly the ones a queue exists to surface.

Thresholds are a convention, not a rule. Pass your own:

```js
band(record, now, { bands: [{ name: "hot", maxDays: 1 }, { name: "rest", maxDays: Infinity }] });
```

---

## State resolution

```js
import { createResolver, sectionise } from "queue-order";

const resolve = createResolver({
  sub:    { when: (r) => r.subPending, label: "Sub pending", exclusive: true },
  trial:  { when: (r) => r.isTrial,    label: "Trial" },
  unpaid: { when: (r) => r.overdue,    label: "Unpaid" },
}, {
  fallback: { label: "Needs a look", tone: "warn" },
});
```

Two rules this enforces, both learned the expensive way:

**An unknown state may never fall through to its raw value.** A bare enum on
screen looks deliberate, so nobody reports it. `SAME_DAY_MOVE_GHOST · Dana`
reached staff for weeks. The resolver refuses to be constructed without a
`fallback`, and keeps the raw value for your logs rather than your UI.

**Some states replace every other state rather than stacking.** That has to be
declared (`exclusive: true`), not remembered by whoever edits the component
next.

---

## Polling without a herd

```js
import { createPoller, jitter } from "queue-order";

const poller = createPoller(refetch, 60_000);   // ±25% by default
poller.start();
poller.stop();
```

Every open tab mounts the same hooks at the same moment and stays in phase. A
handful of reasonable queries then arrive as one self-synchronised herd against
a small database.

**Picking one random offset at mount does not fix this.** It shifts the herd
instead of breaking it, and tabs opened together stay together. The jitter has
to be re-rolled on every tick. That changes only the timing and costs nothing
in freshness.

A throwing poll never stops the schedule — surfacing the error is the caller's
job; the poller's job is to keep asking. An async `fn` is awaited before the
next delay is computed, so a slow response cannot stack calls.

---

## Tests

```bash
npm test     # 30 tests, node:test, no runner to install
```

The tests are written as statements about behaviour rather than coverage —
`no usable date bands LAST, not first`, `an unknown state never renders its raw
value`, `a handled record stays in its slot after it leaves the live list`.

## License

MIT © Timothy G. Smith
