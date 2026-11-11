# Logging Conventions

Which logger you use depends on where the code runs. Structured templates are mandatory everywhere.

## Which logger

| Context | Logger |
|---------|--------|
| Akka actors | `ILoggingAdapter` via `Context.GetLogger()` |
| Services, endpoints, hosted services | `ILogger<T>` from Microsoft.Extensions.Logging |

!!! danger "No ILogger in actors"
    Never inject or use `ILogger` inside an actor. Use the Akka `ILoggingAdapter` so log events carry actor path and flow through the actor system's logging pipeline.

```csharp
public sealed class DownloadWorker : ReceiveActor
{
    private readonly ILoggingAdapter _log = Context.GetLogger();

    public DownloadWorker()
    {
        Receive<StartDownload>(cmd =>
            _log.Info("Starting download {DownloadId}", cmd.DownloadId));
    }
}

public sealed class RuleSetLoader(ILogger<RuleSetLoader> logger)
{
    public void Load(string id) =>
        logger.LogInformation("Loading ruleset {RuleSetId}", id);
}
```

## Structured templates

Use message templates with named placeholders. Never use string interpolation or concatenation in log calls.

```csharp
_log.Warning("Retry {Attempt} for {DownloadId}", attempt, id);   // correct
_log.Warning($"Retry {attempt} for {id}");                        // wrong
```

Interpolation destroys structure (no queryable properties) and allocates even when the level is disabled.

## Thread-safety restrictions

!!! warning "Never log inside PipeTo callbacks"
    `PipeTo` success/failure delegates run outside the actor's message-processing context. Return a message instead and log in the handler that receives it.

!!! warning "Never use `Context.GetLogger()` inside Akka.Streams lambdas"
    Stream stages run on a different thread, and `Context` is not valid there. Capture the `ILoggingAdapter` into a local variable before building the stream, or log from the actor when the stream completes.

```csharp
var log = _log; // captured on the actor thread
Source.From(items)
    .Select(i => { log.Debug("Processing {Item}", i); return i; });
```

## Log levels

| Level | Use for |
|-------|---------|
| Debug | Flow tracing, state transitions, per-message detail |
| Information | Business events (download completed, ruleset loaded) |
| Warning | Recoverable issues (retry, fallback, rejected input) |
| Error | Failures that need attention |

Pass the exception as the first argument rather than formatting its message into the template.

```csharp
_log.Error(ex, "Download {DownloadId} failed", id);
logger.LogError(ex, "Download {DownloadId} failed", id);
```

## Sink configuration

Serilog is the sink, configured once in the host. Domain projects reference only the abstractions (`ILogger<T>`, `ILoggingAdapter`) and never configure sinks, enrichers, or minimum levels themselves.

Minimum levels and overrides belong in `appsettings.json` so they can change per environment without a rebuild.

## Do not log

- Secrets, tokens, API keys, and passwords.
- Full request or response bodies at Information level.
- Personal data without a documented reason.
