# Actor Testing

Conventions for testing Akka.NET actors. Examples assume xUnit.

## Choosing a TestKit

| Scenario | Use |
|----------|-----|
| Actor with DI dependencies, or resolved through the actor registry | `Akka.Hosting.TestKit` |
| Simple actor with no DI | Classic `Akka.TestKit.Xunit` |
| Pure state logic | No TestKit, see [State-only tests](#state-only-unit-tests) |

## Register TestProbes in DI

Actors resolve collaborators through the container or registry, so register
probes there instead of passing actor refs through constructors.

```csharp
public sealed class DownloadManagerTests : Akka.Hosting.TestKit.TestKit
{
    private readonly TestProbe _scheduler;

    public DownloadManagerTests() { _scheduler = CreateTestProbe("scheduler"); }

    protected override void ConfigureAkka(AkkaConfigurationBuilder builder, IServiceProvider provider)
    {
        builder.WithActors((system, registry) =>
        {
            registry.Register<DownloadScheduler>(_scheduler);
            var props = DependencyResolver.For(system).Props<DownloadManager>();
            registry.Register<DownloadManager>(system.ActorOf(props, "manager"));
        });
    }
}
```

## State-only unit tests

If actor state lives in its own class with `Apply(event)` methods, test that class
directly. No actor system, no timing, fast and deterministic.

```csharp
[Fact]
public void Apply_Paused_SetsPausedFlag()
{
    var state = DownloadState.Empty;
    state.Apply(new Paused(Id));
    Assert.True(state.IsPaused);
}
```

Cover `GetSnapshot()` and persistence round-trips (`GetPersistenceState()` then
`FromPersistence()`) the same way.

## Interaction flows

For multi-step flows, chain `ExpectMsg` calls on probes. Each call is a bounded
wait and an assertion in one.

```csharp
manager.Tell(new AddDownload(id, url), TestActor);
var added = ExpectMsg<AddDownloadCompleted>();
Assert.Equal(id, added.DownloadId);

var dispatched = _scheduler.ExpectMsg<WorkAvailable>();
Assert.Equal(id, dispatched.DownloadId);
_scheduler.ExpectNoMsg(TimeSpan.FromMilliseconds(200));
```

## Timeouts

!!! warning "Never use `Thread.Sleep` or `Task.Delay` to wait for an actor"
    Use `ExpectMsg`, `AwaitAssert`, or `ExpectNoMsg` with an explicit duration.
    Timeouts belong on asynchronous operations only; they bound the wait, they
    are not a way to "let things settle".

```csharp
AwaitAssert(() => Assert.Equal(3, store.Count), duration: TimeSpan.FromSeconds(5));
```

## Mocking rules

- **Plain interfaces** (`IDataFiles`, `IHttpClientFactory`, clocks, stores): use
  NSubstitute.
- **Actors**: never mock. Use `TestProbe` or the real actor.

```csharp
var files = Substitute.For<IDataFiles>();
files.Exists(Arg.Any<string>()).Returns(true);
// ...
files.Received(1).Exists(Arg.Is<string>(p => p.EndsWith("state.json")));
```

!!! tip "Persistence"
    Use the in-memory journal and snapshot store for persistent actors, and
    recover by stopping and re-creating the actor with the same persistence id.
