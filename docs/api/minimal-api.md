# Minimal API Endpoint Conventions

Endpoints are thin transport adapters. They translate HTTP into a message, ask a domain actor, and translate the response back into an `IResult`.

## File layout

- One static class per feature area, named `{Feature}ApiEndpoints.cs`.
- One extension method per class: `Map{Feature}Api(this WebApplication app)`.
- Constants (timeouts, `JsonSerializerOptions`) are `private static readonly` fields. They are the only non-lambda content in the class.

```csharp
public static class DownloadsApiEndpoints
{
    private static readonly TimeSpan AskTimeout = TimeSpan.FromSeconds(10);

    public static void MapDownloadsApi(this WebApplication app)
    {
        var group = app.MapGroup("/api/downloads");

        group.MapGet("/", async (IActorRegistry registry, CancellationToken ct) =>
        {
            var manager = await registry.GetAsync<DownloadManager>(ct);
            var response = await manager.Ask<QueryDownloadsResponse>(
                new QueryDownloads(), AskTimeout, ct);

            return response switch
            {
                DownloadsResult r => Results.Ok(r.ToApi()),
                DownloadsFailed f => Results.Problem(f.Cause.Message),
                _ => Results.StatusCode(StatusCodes.Status500InternalServerError)
            };
        });
    }
}
```

## Handlers are inline lambdas

!!! danger "No method group references"
    Handlers must be inline lambdas. `private static` handler methods and method group references (`MapGet("/", HandleList)`) are prohibited.

If a lambda grows too large, the logic does not belong in the endpoint. Move it into the domain layer (actor, service) and keep the lambda a one-liner per step.

## Lambda shape

Every handler follows the same three steps:

1. **Resolve** the actor from `IActorRegistry`.
2. **Ask** with a message. Use `request.ToMessage()` / `request.ToCommand()` when mapping is needed.
3. **Switch** on the response and return an `IResult`.

!!! warning
    No business logic and no multi-actor orchestration in the lambda body. If a request needs two actors, a domain-side coordinator owns that flow.

The only non-inline code an endpoint may call is the mapping extensions, `IActorRegistry.GetAsync`, and `actor.Ask`.

## Route paths

| Rule | Example |
|------|---------|
| Groups use `/api/{feature}` | `/api/downloads` |
| Plural for collections | `downloads`, `rulesets` |
| Singular where natural | `system`, `setup`, `feed` |
| Sub-resources use consistent nesting | `/queue/...`, `/history/...` |
| Action on a resource | `POST /downloads/{id}/pause` |
| Collection-level action | `POST /downloads/pause` |

### Group root

The root of a group uses `"/"`, never `""`.

```csharp
group.MapGet("/", ...);     // correct
group.MapGet("", ...);      // wrong
```

## Exceptions

Self-contained health probes (setup checks) may live directly in the endpoint when no domain actor is involved.

## Checklist

- [x] One class per feature, one `Map{Feature}Api` method
- [x] Inline lambdas only
- [x] Resolve, Ask, switch
- [x] Exhaustive-style response switch with a failure arm
- [x] Root route is `"/"`
