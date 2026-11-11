# Message Conventions

## Naming

| Kind | Name | Response |
|------|------|----------|
| Command | `VerbNoun` (`SearchSeries`, `AddDownload`) | `abstract record VerbNounResponse` with `VerbNounCompleted` / `VerbNounFailed` |
| Query | `QueryNoun` (`QueryRuleSetDetail`) | `abstract record NounResponse` with `NounResult` / `NounFailed` |
| Event (persistence) | Past tense (`ScoringRecorded`) | none |
| Config | Noun (`MatchingConfig`) | none, fire-and-forget |

## Command with responses

Command and its responses live in one file.

```csharp
// AddDownload.cs
public sealed record AddDownload(Guid DownloadId, Uri Source) : IWithDownloadId;

public abstract record AddDownloadResponse;
public sealed record AddDownloadCompleted(Guid DownloadId) : AddDownloadResponse;
public sealed record AddDownloadFailed(Exception Cause) : AddDownloadResponse;
```

## Query with responses

```csharp
// QueryRuleSetDetail.cs
public sealed record QueryRuleSetDetail(string RuleSetId) : IWithRuleSetId;

public abstract record RuleSetDetailResponse;
public sealed record RuleSetDetailResult(RuleSetDetail Detail) : RuleSetDetailResponse;
public sealed record RuleSetDetailFailed(Exception Cause) : RuleSetDetailResponse;
```

Callers switch exhaustively on the response:

```csharp
var response = await actor.Ask<AddDownloadResponse>(cmd, timeout, ct);
return response switch
{
    AddDownloadCompleted ok => Results.Ok(ok.DownloadId),
    AddDownloadFailed f     => Results.Problem(f.Cause.Message),
    _ => throw new InvalidOperationException()
};
```

!!! warning "No domain-wide response interfaces"
    Each command and query owns its response hierarchy. Do not introduce `IDownloadResponse`
    or a shared `Result<T>` base across a domain. Shared response types couple unrelated
    operations and make exhaustive matching meaningless.

## Events and config

```csharp
// Persistence project, past tense
public sealed record ScoringRecorded(Guid ScoringId, int Score, DateTimeOffset At);

// Config: noun, fire-and-forget (Tell, no response)
public sealed record MatchingConfig(int MinimumScore, TimeSpan Timeout);
```

## Entity ID interfaces

Three layers, bottom-up:

| Interface | Member | Purpose |
|-----------|--------|---------|
| `IWithId` | `Guid Id` | Generic Guid identity |
| `IWithEntityId` | `string EntityId` | Routing key used by message extractors |
| `IWith*Id` | domain-typed property | The access point used in code |

Each `IWith*Id` inherits the lower layers and supplies default interface implementations. `Id` and `EntityId` are explicit implementations: invisible on the message, reachable only by cast, which only extractors do.

```csharp
public interface IWithDownloadId : IWithId, IWithEntityId
{
    Guid DownloadId { get; }
    Guid IWithId.Id => DownloadId;
    string IWithEntityId.EntityId => DownloadId.ToString();
}

public interface IWithRuleSetId : IWithEntityId
{
    string RuleSetId { get; }
    string IWithEntityId.EntityId => RuleSetId;
}

public sealed record InitDownload(Guid DownloadId, Uri Source) : IWithDownloadId;
```

### One `IWith*Id` per region

Each interface is a **routing address**, not a data type. Two regions with different purposes get separate interfaces even if the ID value is identical.

!!! example
    `IWithRuleSetId` routes to `RuleSetWorker`. `IWithHistoryId` routes to `HistoryWorker`.
    Both carry a ruleset ID string but are separate routing contracts.

!!! tip "Exception: domain-internal correlation"
    Inside one domain, a single `IWith*Id` may span several regions when the ID correlates
    one multi-actor flow (e.g. `IWithSearchId` across search and evaluation workers).
    Sharing across domains is never allowed.

## File organization

- One file per command or query, including its responses.
- Events and persisted state live in the persistence project (see [Persistence](persistence.md)).
