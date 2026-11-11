# API Models & Mapping

API models are a separate type world from domain messages. Mapping extensions are the explicit bridge between the two.

## Folder layout

```
Models/
  Downloads/
    AddDownloadRequest.cs
    DownloadResponse.cs
    DownloadStatus.cs
  Feed/
  Shared/
    ErrorResponse.cs
    OperationResult.cs
Extensions/
  DownloadsMappingExtensions.cs
```

- Request and response records live in `Models/{Feature}/` subfolders.
- The namespace stays flat (`YourApp.Api.Models`). Subfolders are physical organization only.
- Shared types (`ErrorResponse`, `OperationResult`, shared enums) live in `Models/Shared/`.
- Enums live with the feature that owns them, not in a central `Enums.cs`.

!!! note "One role per file"
    A file contains either request records or response records, not both. The exception is a matched request/response pair for a single endpoint.

## Enums over strings

Request and response records use enum types for every known finite value. Never use `string` for a value from a known set.

```csharp
public enum DownloadStatus
{
    Unknown = 0,
    Queued = 1,
    Running = 2,
    Completed = 3
}

public sealed record DownloadResponse(Guid Id, DownloadStatus Status, DateTimeOffset CreatedAt);
```

- Query parameters that represent enums bind directly as the enum type.
- Never call `.ToString()` on an enum in a response record.
- `DateTimeOffset` and `TimeOnly` stay typed. Do not format them as strings.
- Only exception: values passed through 1:1 to an external API.

!!! tip "Unknown = 0"
    Start every new enum with `Unknown = 0`. Unrecognized input binds to `Unknown` instead of failing with an automatic 400, and handlers reject it explicitly before mapping.

## Mapping extensions

Mapping lives in `Extensions/{Feature}MappingExtensions.cs`.

| Method | Direction |
|--------|-----------|
| `ToApi()` | domain to API model |
| `ToMessage()` / `ToCommand()` | API request to domain message |

```csharp
public static class DownloadsMappingExtensions
{
    public static DownloadResponse ToApi(this DownloadSnapshot s) =>
        new(s.Id, s.Status.ToApi(), s.CreatedAt);

    public static DownloadStatus ToApi(this MessageDownloadStatus value) => value switch
    {
        MessageDownloadStatus.Queued => DownloadStatus.Queued,
        MessageDownloadStatus.Running => DownloadStatus.Running,
        MessageDownloadStatus.Completed => DownloadStatus.Completed,
        _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
    };
}
```

### Enum mapping rules

- Use exhaustive `switch` expressions with a `_ => throw new ArgumentOutOfRangeException(...)` arm.
- Never convert between enum types with numeric casts (`(Target)(int)source`).
- Nullable enums: `x?.ToApi()`.
- A missing arm is a compile error when warnings are treated as errors.
- `Unknown` is handled by the `_ => throw` arm, so handlers must reject it earlier.

## Serialization

API enums serialize as integers. Do not add a global `JsonStringEnumConverter` and do not put serialization attributes on domain message or persistence enums.
