# Options Pattern

!!! danger "Frequently corrected"
    Do not build custom singleton resolution when `IOptions<T>` plus `PostConfigure` already exists. Reaching for a bespoke resolver, plan object, or info service is the most common mistake in this area.

## The standard shape

```csharp
services.AddOptions<DownloadOptions>()
    .Bind(configuration.GetSection(DownloadOptions.SectionName))
    .ValidateOnStart();

services.AddSingleton<IValidateOptions<DownloadOptions>, DownloadOptionsValidator>();
```

- Use `AddOptions<T>().Bind(section).ValidateOnStart()`.
- Do not construct the options object manually and register it with `AddSingleton`.
- Consumers inject `IOptions<T>` (or `IOptionsMonitor<T>` when values may change at runtime).

## Computed and derived values: PostConfigure

When a value depends on other registrations or other options (for example, resolving requirements from the set of registered features), compute it in `PostConfigure`.

```csharp
services.AddOptions<PipelineOptions>()
    .Bind(configuration.GetSection("Pipeline"))
    .PostConfigure<IEnumerable<IFeature>>((options, features) =>
    {
        options.Requirements = features
            .SelectMany(f => f.Requirements)
            .Distinct()
            .ToArray();
    })
    .ValidateOnStart();
```

`PostConfigure` runs after all `Configure` / `Bind` calls, so it sees the final bound values and can safely derive from them.

!!! note
    `PostConfigure<TDep>` accepts injected dependencies, so there is no need for a hand-written factory or a lazily built singleton.

## Validation: IValidateOptions

Use a dedicated `IValidateOptions<T>` class. Do not use inline lambdas in `.Validate(...)` for anything beyond a trivial one-liner.

```csharp
public sealed class DownloadOptionsValidator : IValidateOptions<DownloadOptions>
{
    public ValidateOptionsResult Validate(string? name, DownloadOptions options)
    {
        var failures = new List<string>();

        if (options.MaxParallel < 1)
        {
            failures.Add($"{nameof(options.MaxParallel)} must be at least 1.");
        }

        if (string.IsNullOrWhiteSpace(options.TargetDirectory))
        {
            failures.Add($"{nameof(options.TargetDirectory)} is required.");
        }

        return failures.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(failures);
    }
}
```

A class is testable in isolation, can take injected dependencies, and reports all failures at once.

## Defaults

Defaults belong in `appsettings.json` or environment variables, not in code.

| Do | Don't |
|----|-------|
| `"MaxParallel": 2` in `appsettings.json` | `public int MaxParallel { get; set; } = 2;` scattered across classes |
| Override with `Download__MaxParallel=4` | `options ??= new DownloadOptions { ... }` |

Required values should be `required` properties or validated, so a missing setting fails at startup instead of silently using a code default.

## Anti-patterns

- A `FetchPlan` / `ServiceInfo`-style object that recomputes state from several options. Use `PostConfigure` or a dedicated service that injects `IOptions<T>`.
- Custom singleton resolution or static accessors for options.
- `new MyOptions(...)` in application code.
- Validation that only runs on first use. Always call `ValidateOnStart()`.

## Decision guide

1. Plain settings: `Bind` + `ValidateOnStart`.
2. Rules over those settings: `IValidateOptions<T>`.
3. Values derived from settings or registrations: `PostConfigure`.
4. Behavior (not data) built from multiple options: a dedicated service injecting `IOptions<T>`.
