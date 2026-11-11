# Async Patterns

Rules for asynchronous code, cancellation, time, and concurrency.

## No blocking on async

Never use `async void`, `.Result`, or `.Wait()`. They cause deadlocks and swallow or wrap exceptions.

```csharp
// WRONG
public async void OnMessage(Message m) { await HandleAsync(m); }
var result = client.GetAsync(url).Result;
task.Wait();

// RIGHT
public async Task OnMessageAsync(Message m, CancellationToken ct)
{
    await HandleAsync(m, ct);
}
var result = await client.GetAsync(url, ct);
```

!!! warning
    `async void` is acceptable only for UI event handlers, which this codebase does not have.

## CancellationToken everywhere

Accept a `CancellationToken` in every async method and pass it down the entire call chain.

```csharp
public async Task<Invoice> LoadAsync(Guid id, CancellationToken ct)
{
    var row = await _db.Invoices.SingleAsync(i => i.Id == id, ct);
    return await _mapper.MapAsync(row, ct);
}
```

Tests pass `TestContext.Current.CancellationToken` to every call that accepts a token (analyzer xUnit1051).

```csharp
[Fact]
public async Task Loads_invoice()
{
    var ct = TestContext.Current.CancellationToken;
    var invoice = await _service.LoadAsync(id, ct);
    Assert.Equal(id, invoice.Id);
}
```

## TimeProvider, not DateTime

Inject `TimeProvider`. Never read `DateTime.Now` or `DateTime.UtcNow` directly. This makes time-dependent logic deterministic in tests.

```csharp
public sealed class ExpiryChecker
{
    private readonly TimeProvider _clock;

    public ExpiryChecker(TimeProvider clock)
    {
        _clock = clock;
    }

    public bool IsExpired(DateTimeOffset expiresAt) => _clock.GetUtcNow() >= expiresAt;
}
```

In tests, use `FakeTimeProvider` and call `Advance(...)` instead of sleeping.

## No ContinueWith in actor code

`Task.ContinueWith()` bypasses the actor's threading guarantees and may run on any thread. Use `PipeTo` with explicit success and failure mappings instead.

```csharp
// WRONG
_client.FetchAsync(url).ContinueWith(t => new Fetched(t.Result));

// RIGHT
_client.FetchAsync(url, ct).PipeTo(
    Self,
    success: body => new Fetched(body),
    failure: ex => new FetchFailed(ex));
```

!!! tip
    Define your own `XxxFailed(Exception Cause)` message rather than relying on framework failure wrappers.

## ConfigureAwait

Follow the project default. Do not sprinkle `ConfigureAwait(false)` on individual awaits.

- Application code (ASP.NET Core, workers, actors) has no synchronization context, so it has no effect.
- Libraries intended for general reuse may set it consistently, enforced by an analyzer, never ad hoc.

## Structured concurrency

Prefer higher-level primitives over manual `Task` management.

| Need | Use |
|------|-----|
| Producer/consumer, buffering, back-pressure | `System.Threading.Channels` |
| Stateful entities, serialized access | Actors |
| Parallel I/O with a bound | `Parallel.ForEachAsync` with `MaxDegreeOfParallelism` |

```csharp
var channel = Channel.CreateBounded<Job>(capacity: 100);

await foreach (var job in channel.Reader.ReadAllAsync(ct))
{
    await ProcessAsync(job, ct);
}
```

!!! warning
    Avoid fire-and-forget `Task.Run` and unobserved tasks. Every task must be awaited, piped, or owned by a component that observes its failure.
