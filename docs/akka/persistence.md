# Persistence Conventions

Three tools, each with exactly one job.

| Tool | Job |
|------|-----|
| `Persist(evt, callback)` | Write the event to the journal. Stashes incoming commands until the callback runs. State update goes in the callback. |
| `DeferAsync(evt, callback)` | Run the callback **after all preceding Persist handlers complete**. Persists nothing; `evt` is not journaled or replayed. |
| `SaveSnapshot(state)` | Compact recovery for unbounded-growth actors. Interval-based. |

## Persist

```csharp
private void HandlePause(PauseCmd cmd)
{
    var evt = new PersistedPaused(cmd.Id, At: _time.GetUtcNow());
    Persist(evt, e =>
    {
        _state.Apply(e);
        Sender.Tell(new PauseCompleted());   // inline: single reply
    });
}
```

`Sender` is preserved inside `Persist` callbacks, so no `var sender = Sender` capture is needed (unlike `PersistAsync`).

## DeferAsync

Use when side effects are non-trivial **and** the handler does not call `Persist`/`PersistAll` itself:

- starting external processes or HTTP calls
- fan-out to two or more actors
- sending a response after nested Persists

```csharp
private const int SnapshotInterval = 10;

private void HandleCreate(CreateCmd cmd)
{
    Persist(new PersistedCreated(cmd.Id), e =>
    {
        _state.Apply(e);
        if (LastSequenceNr % SnapshotInterval == 0)
            SaveSnapshot(_state.GetPersistenceState());
    });
    DeferAsync("notify", _ =>
    {
        _manager.Tell(_state.GetRegistryUpdate());
        Sender.Tell(new CreateCompleted(_state.Id));
    });
}
```

!!! warning "CRITICAL: never DeferAsync around a handler that persists"
    If the handler calls `DispatchNext` or any method that calls `Persist`/`PersistAll`,
    do **not** wrap it in `DeferAsync`. `PersistAll` inside `DeferAsync` breaks the event
    batch pipeline: the inner events never reach the journal. Keep everything inline in
    the outer Persist callback.

Inline in the Persist callback is fine for a single `Sender.Tell`, logging, and metrics counters.

## Snapshots

- Only for unbounded-growth actors (singletons, long-lived entities). Short-lived entities with a handful of events need none.
- Interval-based: `LastSequenceNr % SnapshotInterval == 0`.
- Always snapshot the persistence DTO: `SaveSnapshot(_state.GetPersistenceState())`, never `SaveSnapshot(_state)`.

!!! warning "Never snapshot unconditionally"
    `SaveSnapshot` in every Persist callback doubles I/O per command.

## PersistenceId

Singletons use a literal. Entities use a prefix plus the entity ID via the C# 14 `field` keyword: the getter adds the prefix, the constructor assigns the raw ID.

```csharp
// Singleton
public override string PersistenceId => "feed-crawl";

// Entity
public override string PersistenceId => $"download-{field}";
// constructor:
public DownloadWorker(string entityId) { PersistenceId = entityId; }
```

## Persistence DTOs

Live in a dedicated persistence project, separate from message types.

- **Extend-only records.** Add members; never remove or change existing ones.
- **No `Event`/`Dto` suffix:** `PersistedPaused`, `PersistedDownloadState`.
- **Explicit `int` values on every enum**, starting at 0. Never change, reuse or reorder.
- No serialization attributes on shared enums, no custom serializers.

```csharp
public enum PersistedSearchSource
{
    Unknown = 0,
    Api = 1,
    Manual = 2,
    Feed = 4      // gaps are fine; 3 stays retired
}
```

## Mapping

Conversion between domain messages and persistence DTOs lives in the **domain project** as `*MappingExtensions.cs`. The shared core references both sides but contains no mapping logic.

```csharp
public static class DownloadMappingExtensions
{
    public static PersistedDownloadStatus ToPersistence(this DownloadStatus s) => s switch
    {
        DownloadStatus.Queued => PersistedDownloadStatus.Queued,
        DownloadStatus.Done   => PersistedDownloadStatus.Done,
        _ => throw new ArgumentOutOfRangeException(nameof(s), s, null)
    };
}
```

Enum conversion uses exhaustive `switch` expressions, never numeric casts.
