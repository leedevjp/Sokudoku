# Browser-owned preparation and synchronization

`SyncBridge` lives in the root layout. Its dedicated Web Worker survives client
navigation between home, game and dashboard. Login changes replace its owner;
private IndexedDB snapshots and outbox entries are partitioned by that owner.
The worker wakes on navigation to home/dashboard, online/focus, checkpoints and
a 15-second retry interval. Web Locks serialize sync across same-origin tabs.

The worker checks `/api/sync` for dataset revisions before pulling. Common words,
all approved-choice source records, personal words, answers, canonical learning
cards and learner state are prepared, regardless of the selected training scope.
Images/effects/music are warmed through their content-addressed HTTP cache URLs.
The game filters its scope locally. A complete snapshot starts immediately even
while an upload is outstanding; only first preparation waits for missing data.

Postgres `sync_versions` counters are advanced in the original mutation's
transaction. Updates to the same head serialize until commit. `sync_changes`
retains the latest value or deletion tombstone for every record. Server-owned
revisions are distinct from local unsent answers; clients cannot write revisions.
RLS permits common rows and the caller's own rows only. Trigger helpers are
restricted to the unexposed `sync_private` schema.

Pulls use bounded 2,000-row pages with an indexed `(scope,dataset,version,key)`
cursor and a fixed upper revision per dataset. After all pages, the worker checks
the manifest again and catches up changes made during the download. The complete
snapshot and its cursors are committed in one IndexedDB transaction. Partial
downloads never replace a usable snapshot.
Datasets are stored separately, so answer checkpoints do not rewrite unchanged
common dictionaries or choice banks. Warm worker reads reuse unchanged datasets.

Every answer receives a UUID and is written to the separate IndexedDB outbox.
Exit waits only for local durability, then navigates home. The root worker posts
outbox batches, validates server acknowledgements, pulls canonical state, and
atomically commits that state while deleting only acknowledged outbox IDs. A
crash after server commit but before local acknowledgement replays the same UUID.
The server's existing idempotent answer insert, chronological FSRS replay and
revision-checked commit merge late answers from different devices. Clients never
upload their calculated final FSRS state over another device's state.
The manifest also checks the indexed set of unprocessed answers, so a failed
server background calculation is retried even when download cursors match.

The dashboard keeps its existing account/timezone-scoped cached display and
network refresh. It also wakes the shared sync worker and refreshes again on
completed sync updates. Initial statistics reads do not wait for vocabulary
downloads. The server remains the authority for canonical statistics.
