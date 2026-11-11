# Akka.Streams Discipline

!!! warning "Most frequently violated page"
    These rules are the ones broken and corrected most often. Read them before writing any stream.

## Rules

### 1. No context access in streams

Streams run on different threads than the actor's mailbox. Never touch actor fields, `Context`, `Sender`, or any mutable state from inside a stream lambda. Pass everything the stream needs as parameters when building the graph.

### 2. Flat pipelines

One flat `Source -> Flow -> Sink`. No streams inside streams, no nested `RunAsync` inside a stage.

### 3. No PipeTo inside streams

`PipeTo` belongs at the actor level, applied to the materialized result, not inside stages.

### 4. Use the built-in Ask stage

Use `.Ask<T>(actor, timeout)` rather than `SelectAsync(1, async x => await actor.Ask<T>(x))`. It handles parallelism, timeouts and failure propagation correctly.

### 5. No ContinueWith

Same as in actors: use `PipeTo` with `success:` and `failure:`.

### 6. No static helpers or custom GraphStages

Keep logic in the lambda. If it is too complex, it belongs in a service injected via DI, not a static helper or a hand-written stage.

### 7. No external state mutation

Side effects go into `DivertTo` / `WireTap` side channels, not into `Select`/`SelectAsync` lambdas that mutate outside variables.

### 8. Streams do not die in normal operation

If a stream terminates unexpectedly, find the root cause. Do not paper over it with restart logic.

## Correct pipeline

Everything the stream needs is passed in at build time. The actor only materializes and pipes the result.

```csharp
public sealed class HarvestActor : ReceiveActor
{
    public HarvestActor(IFeedSource source, IActorRef store, IMaterializer mat)
    {
        // Resolved on the mailbox thread, captured as plain values
        var storeRef = store;

        Receive<StartHarvest>(cmd =>
        {
            var done = source.Items(cmd.FeedUrl)                       // Source<RawItem>
                .Select(item => item.Normalize())                       // pure
                .DivertTo(
                    Sink.ForEach<RawItem>(_ => { }),                    // rejected -> side channel
                    item => item.IsRejected)
                .Ask<StoreResponse>(storeRef, TimeSpan.FromSeconds(5), parallelism: 4)
                .RunWith(Sink.Ignore<StoreResponse>(), mat);

            done.PipeTo(Self,
                success: () => new HarvestCompleted(cmd.FeedUrl),
                failure: ex => new HarvestFailed(ex));
        });
    }
}
```

## Hall of shame

!!! warning "Context access inside a stage"
    ```csharp
    .Select(x => { _counter++; Sender.Tell(x); return x; })   // actor fields + Sender
    ```

!!! warning "Stream in a stream"
    ```csharp
    .SelectAsync(1, async x =>
        await Source.From(x.Children).RunWith(Sink.Seq<Child>(), mat))   // nested RunWith
    ```

!!! warning "Manual SelectAsync + Ask"
    ```csharp
    .SelectAsync(1, async x => await store.Ask<StoreResponse>(x))
    ```
    Use `.Ask<StoreResponse>(store, timeout)`.

!!! warning "PipeTo and ContinueWith in a stage"
    ```csharp
    .SelectAsync(1, x => Save(x).ContinueWith(t => t.Result))
    .Select(x => { Save(x).PipeTo(Self); return x; })
    ```

!!! warning "Static helper or custom stage"
    ```csharp
    .Select(x => FeedHelpers.ParseAndMerge(x))     // static helper
    .Via(new MyCustomGraphStage())                 // hand-rolled stage
    ```
    Inject an `IItemParser` service and call it in the lambda.

!!! warning "Mutating outside state"
    ```csharp
    var seen = new HashSet<string>();
    .Select(x => { seen.Add(x.Id); return x; })    // shared mutable state across threads
    ```
    Use `StatefulSelectMany`, `Sliding`, `GroupBy`, or a `WireTap` to a sink that owns the state.

!!! warning "Restart-on-failure as a fix"
    ```csharp
    RestartSource.OnFailuresWithBackoff(() => flakySource, settings)   // hides the real bug
    ```
    A source that dies repeatedly has a root cause. Fix it.

## Review checklist

- [ ] Lambdas reference only parameters and injected services
- [ ] Single flat graph, one materialization
- [ ] `.Ask<T>()` stage, no manual `SelectAsync` + `Ask`
- [ ] `PipeTo` only on the materialized `Task`
- [ ] Side effects via `DivertTo` / `WireTap`
- [ ] No restart wrapper masking failures
