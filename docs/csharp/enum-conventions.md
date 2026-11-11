# Enum Conventions

!!! warning "High-priority rules"
    These rules are violated often and are costly to fix once values are stored or on the wire. Follow them exactly.

## Every enum starts with `Unknown = 0`

`default(T)` must be detectably "unset". Every new enum declares an explicit `Unknown = 0` member.

```csharp
public enum DownloadState
{
    Unknown = 0,
    Queued = 1,
    Running = 2,
    Completed = 3
}
```

Unrecognized external values then bind to `Unknown` instead of failing model binding with an automatic 400. API handlers reject `Unknown` explicitly with the protocol's own error, before mapping.

## Persistence enums: explicit values on every member

Every member of every persistence enum has an explicit `int` value. The values are a stored contract.

```csharp
public enum PersistedDownloadState
{
    Unknown = 0,
    Queued = 1,
    Running = 2,
    Completed = 3,
    Failed = 5   // gaps are fine; 4 was never used or was removed
}
```

!!! warning
    Never change, reuse, or reorder stored values. New members get a new, unused value.

## Enum-to-enum mapping: exhaustive `switch`

Map between enum types (API, message, persistence) with a `switch` expression that throws for everything unhandled, including `Unknown`.

```csharp
public static class DownloadStateMappingExtensions
{
    public static PersistedDownloadState ToPersistence(this DownloadState value) => value switch
    {
        DownloadState.Queued => PersistedDownloadState.Queued,
        DownloadState.Running => PersistedDownloadState.Running,
        DownloadState.Completed => PersistedDownloadState.Completed,
        _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
    };

    public static PersistedDownloadState? ToPersistence(this DownloadState? value) =>
        value?.ToPersistence();
}
```

Nullable enums use null propagation at the call site: `x?.ToPersistence()`.

!!! tip
    Treat CS8509 (non-exhaustive switch) as an error, together with `TreatWarningsAsErrors`. Adding a member then breaks the build at every mapping that needs updating.

## Anti-patterns

```csharp
// WRONG: numeric cast silently maps by position, breaks on any reorder
var persisted = (PersistedDownloadState)(int)state;

// WRONG: string conversion in a response record
return new DownloadResponse(State: state.ToString());

// WRONG: no Unknown member, default(T) looks like a valid value
public enum Mode { Fast = 0, Slow = 1 }

// WRONG: missing the throwing arm, unknown values map silently
state switch { DownloadState.Queued => PersistedDownloadState.Queued, _ => default };
```

!!! warning "Never convert between enum types with numeric casts"
    `(Target)(int)source` is forbidden everywhere. Always use a `switch` expression.

## Serialization

- API enums serialize as integers. Do not register a global `JsonStringEnumConverter`.
- Use per-type string converters only where an external protocol requires string values.
- Query parameters bind directly to the enum type.
- Never put serialization attributes such as `[JsonStringEnumMemberName]` on message or persistence enums. Use them only on API enums where an external protocol requires it.

## Dates and times in responses

Keep rich types. Formatting is the serializer's job.

```csharp
// RIGHT
public sealed record ScheduleResponse(DateTimeOffset StartsAt, TimeOnly DailyAt, DownloadState State);

// WRONG
new ScheduleResponse(StartsAt: start.ToString("o"), DailyAt: at.ToString("HH:mm"), State: state.ToString());
```

`DateTimeOffset` stays `DateTimeOffset`, `TimeOnly` stays `TimeOnly`, and response records never call `.ToString()` on enum values.
