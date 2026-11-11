# Actor Design Conventions

Actors are **thin plumbing**: message routing, persistence hooks and lifecycle. Domain logic and mutable domain state live elsewhere (see [State Management](state-management.md)).

## Naming

| Suffix | Meaning |
|--------|---------|
| `*Manager` | Cluster Singleton |
| `*Worker` | Sharded entity or local entity region entity |
| `*Actor` | Everything else: pools, plain actors, children |

```csharp
public sealed class DownloadManager : ReceiveActor { }   // singleton
public sealed class DownloadWorker : ReceiveActor { }    // sharded entity
public sealed class ScoringActor : ReceiveActor { }      // pooled child
```

## Thin actors

An actor receives a message, delegates to its state object, and sends a reply. Nothing else.

```csharp
public sealed class CounterWorker : ReceiveActor
{
    private readonly CounterState _state = CounterState.Empty;

    public CounterWorker()
    {
        Receive<Increment>(cmd =>
        {
            _state.Apply(cmd);
            Sender.Tell(new IncrementCompleted(_state.Value));
        });
        Receive<QueryCounter>(_ => Sender.Tell(_state.GetSnapshot()));
    }
}
```

!!! tip "Prefer one Receive block over many tiny handlers"
    Keep actors simple. One constructor with a flat list of `Receive<T>` registrations
    is easier to read than eight `HandleXyz` methods that each need a jump to understand.
    Extract a method only when it is genuinely reused or hides real complexity.

## Dependency injection and actor resolution

Use `resolver.Props<T>()` when an actor needs DI dependencies. Resolve other actors at runtime with `context.GetActor<T>()`.

```csharp
// Creating
var props = resolver.Props<ScoringActor>();

// Resolving a peer
var manager = Context.GetActor<DownloadManager>();
manager.Tell(new EnqueueDownload(id));
```

!!! warning "Never pass `IActorRef` as a constructor parameter"
    Actor refs injected through constructors are fixed at construction, break on restart
    and hide the topology. Resolve through the registry or `Context` instead.

## Async work: PipeTo, not ContinueWith

`Task.ContinueWith` bypasses Akka's threading guarantees. Use `PipeTo` with both `success:` and `failure:`.

```csharp
// Wrong
_client.FetchAsync(cmd.Url).ContinueWith(t => Self.Tell(t.Result));

// Right
_client.FetchAsync(cmd.Url, ct)
    .PipeTo(Self,
        success: r => new FetchCompleted(r),
        failure: ex => new FetchFailed(ex));
```

## Failures are project-owned messages

Never use Akka's `Status.Failure`. Define a failure record per operation.

```csharp
public sealed record FetchFailed(Exception Cause);
```

!!! warning "No `Status.Failure`"
    It is untyped, cannot be matched to the operation that failed and invites catch-all handlers.
    Every `PipeTo` must supply a `failure:` projection to an `XxxFailed` record.

## No EventStream

Do not use `EventStream.Publish` or `Subscribe`. Communication goes through explicit actor references (Tell/Ask via registry or `Context.GetActor<T>()`). Explicit wiring is traceable, testable with `TestProbe`, and does not leak messages between unrelated components.

## Checklist

- [ ] Name matches role (`Manager`, `Worker`, `Actor`)
- [ ] State in its own `<Actor>State.cs` class
- [ ] No `IActorRef` constructor parameters
- [ ] No `ContinueWith`, `Status.Failure`, `EventStream`
- [ ] Every `PipeTo` has `success:` and `failure:`
