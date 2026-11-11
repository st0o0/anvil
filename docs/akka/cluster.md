# Cluster & Sharding

Three hosting shapes, each with a fixed naming convention.

| Shape | Suffix | Routing | Persistence |
|-------|--------|---------|-------------|
| Cluster Singleton | `*Manager` | one instance per cluster | literal `PersistenceId` |
| Shard Region | `*Worker` | entity ID via message extractor | `prefix-{entityId}` |
| Local Entity Region | `*Worker` | entity ID via `EntityIdExtractor`, node-local | `prefix-{entityId}` |

## Cluster Singletons

Use for coordinators that must exist exactly once: schedulers, registries, orchestrators. Name them `*Manager`. If persistent, use a literal PersistenceId.

```csharp
public sealed class DownloadManager : ReceivePersistentActor
{
    public override string PersistenceId => "download-manager";
}
```

## Shard Regions

Use for entities that must be distributed across nodes. Name them `*Worker`. Routing is based on the entity ID that messages expose through `IWithEntityId` (see [Messaging](messaging.md)).

```csharp
builder.WithShardRegion<DownloadWorker>(
    typeName: "download",
    entityPropsFactory: (_, _, resolver) => id => resolver.Props<DownloadWorker>(id),
    messageExtractor: new ShardMessageExtractor(),
    shardOptions: new ShardOptions
    {
        PassivateIdleEntityAfter = TimeSpan.FromMinutes(5)
    });
```

## Local Entity Regions

Same entity pattern as sharding (ID-based routing, passivation, message extractor) but local to the node. Use for request-scoped or short-lived entities that do not need cluster distribution. Entities self-passivate after finishing their work.

```csharp
builder.WithEntityRegion<SearchWorker, SearchKey>(...);   // EntityIdExtractor works with IWithEntityId
```

Because the protocol matches cluster sharding, an entity can migrate between the two without code changes.

## Passivation

!!! warning "Choose the mechanism by region type"
    - **Cluster sharding:** configure `ShardOptions { PassivateIdleEntityAfter = ... }` in the setup container.
      Never use `Context.SetReceiveTimeout` plus a manual `Passivate` inside a sharded entity.
    - **Local entity regions:** the entity signals completion with a `Passivate` message to its parent.
      `EntityRegionOptions.PassivationTimeout` is only a safety net for stuck entities.

```csharp
// Local region entity, done with its work
Receive<WorkFinished>(_ =>
{
    Sender.Tell(new WorkCompleted());
    Context.Parent.Tell(new Passivate(PoisonPill.Instance));
});
```

## Routing interfaces

- One `IWith*Id` per region. Each interface is a routing address, not a data type.
- Two regions with different purposes get separate interfaces even if the ID value is the same.
- Domain-internal exception: one `IWith*Id` may span several regions of the same domain when it correlates a single multi-actor flow.

!!! warning "Cross-domain sharing is never allowed"
    Domains talk through messages. A routing interface shared between domains couples them
    at the type level and defeats domain isolation.

## Choosing a shape

!!! tip "Decision guide"
    - Exactly one instance, coordinates others: **Manager (singleton)**
    - Many independent entities, must survive node loss: **Worker in a shard region**
    - Many short-lived entities tied to a single node's request: **Worker in a local entity region**
    - Fixed-size parallel compute without identity: **`*Actor` in a pool** (not an entity region)

## Singleton caveats

- A singleton is a potential bottleneck. Keep it thin and delegate work to workers.
- During handover the singleton restarts on another node, so state must be recoverable (persistence or re-derivable).
- Child actors of a singleton are created at runtime through `Context.GetActor<T>()` or `ResolveChildActor<T>()`, not via constructor-injected refs.
