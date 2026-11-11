# Supervision Strategies

Supervision decides what happens when a child actor throws. Defaults are good; deviate deliberately.

## Default behavior

| Exception | Directive |
|-----------|-----------|
| `ActorInitializationException` | Stop |
| `ActorKilledException` | Stop |
| `DeathPactException` | Stop |
| Any other `Exception` | Restart |

For most actors this is correct. Do not add a strategy unless the default is wrong for your case.

## BackoffOnFailure for persistent actors

A persistent actor that fails during recovery or while writing will restart immediately and hammer the journal. Wrap it in a backoff supervisor so restarts are spaced out with jitter.

```csharp
var props = resolver.Props<DownloadManager>()
    .BackoffOnFailure(
        childName: "download-manager",
        minBackoff: TimeSpan.FromSeconds(3),
        maxBackoff: TimeSpan.FromSeconds(30),
        randomFactor: 0.2);
```

!!! tip "Why backoff"
    Journal outages are usually transient. Immediate restarts create a restart storm that
    keeps the database overloaded. Exponential backoff with jitter lets it recover and
    prevents many actors from retrying in lockstep.

## Custom SupervisorStrategy

Override only when the default does not fit, for example a parent managing children that wrap flaky external resources.

```csharp
protected override SupervisorStrategy SupervisorStrategy() =>
    new OneForOneStrategy(
        maxNrOfRetries: 3,
        withinTimeRange: TimeSpan.FromMinutes(1),
        decider: Decider.From(ex => ex switch
        {
            HttpRequestException => Directive.Restart,
            ArgumentException    => Directive.Stop,     // bad input will never succeed
            _                    => Directive.Escalate
        }));
```

- `OneForOneStrategy`: only the failing child is affected (the usual choice).
- `AllForOneStrategy`: all siblings restart together; use only when children share inseparable state.
- Always bound retries (`maxNrOfRetries` + `withinTimeRange`), otherwise a poison message loops forever.

## Escalation

`Directive.Escalate` hands the decision to the parent's supervisor. Use it for exceptions the current parent has no business handling.

```csharp
decider: Decider.From(ex => ex switch
{
    TransientIoException => Directive.Restart,
    _ => Directive.Escalate     // unknown: let the grandparent decide
});
```

!!! example "Escalation chain"
    `Worker` fails with an unknown error, `Manager` escalates, the root guardian
    restarts or stops the subtree. The further up it travels, the larger the blast radius,
    so escalate only genuinely unexpected failures.

## Never suppress errors

!!! warning "Find the root cause"
    - Do not catch and swallow exceptions inside `Receive` handlers to "keep the actor alive".
    - Do not use `Directive.Resume` to ignore failures; it keeps corrupted state running.
    - Do not wrap everything in a restart-forever policy to hide a bug.

    A crash is information. Let it surface, log it with context, fix the cause.

Prefer typed failure messages for expected failures, and exceptions for unexpected ones:

```csharp
// Expected, recoverable: model it
_client.FetchAsync(url, ct)
    .PipeTo(Self, success: r => new FetchCompleted(r), failure: ex => new FetchFailed(ex));

// Unexpected invariant violation: throw and let supervision handle it
Receive<Apply>(cmd => _state.Apply(cmd) /* throws on corrupt input */);
```

## Guidelines

- Persistent actors: BackoffOnFailure.
- Pools and routers: use the router's own strategy, rarely customized.
- Custom strategies: rare, documented with a comment explaining why the default fails.
- Escalate what you cannot handle; never swallow it.
