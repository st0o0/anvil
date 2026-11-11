# DI Conventions

Dependency injection is organized per domain and composed in `Program.cs`. The container is never queried by application code.

## Composable `Add*` extensions

Group related registrations into `Add*` extension methods on `IServiceCollection`. Tests can then reuse the same composition.

```csharp
public static class SearchServiceCollectionExtensions
{
    public static IServiceCollection AddSearch(this IServiceCollection services)
    {
        services.AddOptions<SearchOptions>()
            .BindConfiguration(SearchOptions.SectionName)
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<SearchOptions>, SearchOptionsValidator>();

        services.AddHttpClient<IMediaClient, MediaClient>();
        return services;
    }
}
```

## Per-domain setup containers

Each domain owns a setup container implementing a setup interface (for example `ISetup<IServiceCollection>`). The host applies them in a deliberate order.

```csharp
builder.Setups()
    .Add<LoggingSetupContainer>()
    .Add<TelemetrySetupContainer>()
    .Add<SearchSetupContainer>()
    .Add<DownloadSetupContainer>();

var app = builder.Build();

app.Setups()
    .Add<SearchEndpointsSetupContainer>()
    .Add<ApplicationSetupContainer>();
```

!!! warning "Order matters"
    Logging and telemetry are applied first. The application-level container is applied last, after every domain has registered its services and endpoints.

Domain setup containers live in their own domain project. The host only references the container type, never the individual registrations.

## No service locator

!!! danger
    Never inject `IServiceProvider` to resolve dependencies on demand. Declare dependencies in the constructor.

Legitimate exceptions are infrastructure factories that must create scoped instances (for example a hosted service creating a scope per unit of work, or an actor DI resolver). Keep them in one place and do not spread them into domain code.

## Options, not manual construction

- Never write `new MyOptions(...)` and register it as a singleton.
- Inject `IOptions<T>` (or `IOptionsMonitor<T>` / `IOptionsSnapshot<T>` when reload semantics are needed) everywhere.
- See [Options Pattern](options-pattern.md) for binding, validation, and `PostConfigure`.

## Validators live next to options

Register the `IValidateOptions<T>` implementation in the same `Add*` method that registers the options. A reader should find binding, validation, and start-up validation in one place.

```csharp
services.AddOptions<DownloadOptions>().BindConfiguration("Download").ValidateOnStart();
services.AddSingleton<IValidateOptions<DownloadOptions>, DownloadOptionsValidator>();
```

## Lifetimes

| Lifetime | Use for |
|----------|---------|
| Singleton | Stateless services, caches, HTTP client factories |
| Scoped | Per-request state (EF Core `DbContext`) |
| Transient | Lightweight, stateless helpers |

Never capture a scoped service in a singleton. Enable `ValidateScopes` and `ValidateOnBuild` in development to catch it early.
