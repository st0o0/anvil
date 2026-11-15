# Anvil - .NET & Akka.NET Convention Pack

> Condensed rules for AI coding assistants. Full reference: https://anvil.st0o0.net/llms-full.txt

## C# Conventions

- Classes and records are `sealed` by default. Unseal only for a concrete need.
- Use `record` for messages, DTOs, value objects. Use `sealed class` for mutable state and behavior.
- Wrap primitive IDs in `readonly record struct` (e.g. `CustomerId(Guid Value)`) to prevent swaps.
- Nullable reference types enabled everywhere. No `#pragma warning disable`.
- `var` when the type is apparent. Explicit type when it is not.
- No XML docs. Names carry the meaning. Comments only explain *why*, never *what*.
- `TreatWarningsAsErrors` is on. Zero warnings. No `NoWarn`, no `#pragma warning disable`.
- Composition over inheritance. No abstract base classes for domain types.
- No `Helper` or `Utils` dumping-ground classes.

## Akka.NET Actors

- Actors are thin plumbing: receive message, delegate to state, send reply. No domain logic in actors.
- Naming: `*Manager` = singleton, `*Worker` = sharded entity, `*Actor` = everything else.
- All mutable state lives in a dedicated `<Actor>State.cs` class, not on the actor.
- State is a `sealed class` with `Apply()` overloads (not `ApplyFoo`/`ApplyBar`).
- `Empty` is a property, never a shared static field (avoids cross-actor mutation).
- Never send state to callers. Use `GetSnapshot()` to produce a response record.
- No `IActorRef` constructor parameters. Resolve via `Context.GetActor<T>()`.
- Use `PipeTo` with both `success:` and `failure:`. Never `ContinueWith`.
- No `Status.Failure`. Define `XxxFailed` records per operation.
- No `EventStream.Publish/Subscribe`. Use explicit actor references.

## Messages

- Command: `VerbNoun` with `VerbNounCompleted`/`VerbNounFailed` response hierarchy.
- Query: `QueryNoun` with `NounResult`/`NounFailed` response hierarchy.
- Event (persistence): past tense (`ScoringRecorded`). No response.
- Config: noun (`MatchingConfig`). Fire-and-forget.
- One file per command/query, including its responses.
- Each command owns its response hierarchy. No shared `Result<T>` across operations.

## Testing

- Tests pin behavior and catch regressions. Not for coverage numbers.
- Assert observable outcomes, not absence of exceptions.
- One logical behavior per test, named after that behavior.
- `Assert.Equal(expected, actual)` over `Assert.True(...)`.
- One test class per production class. No shared base test classes.
- No `Thread.Sleep`. Use `AwaitAssert` or `TestProbe.ExpectMsg`.
- State classes are testable without `ActorSystem` - test them directly.

## API Design

- Endpoints are thin transport adapters: HTTP -> message -> actor -> response -> HTTP.
- API models are separate types from domain messages. Explicit mapping extensions bridge them.

## DI & Configuration

- DI organized per domain, composed in `Program.cs`. Never query the container.
- Options validated on startup with `IValidateOptions<T>`.

## Observability

- `System.Diagnostics.Metrics` with one meter per domain.
- Structured log templates mandatory. `ILoggingAdapter` in actors, `ILogger<T>` in services.

## CI/CD

- `dotnet format` enforced in CI. Build rejects violations.
- Warnings as errors. Zero warnings policy.

---

Full reference with code examples: https://anvil.st0o0.net/llms-full.txt
All pages: https://anvil.st0o0.net/llms.txt
