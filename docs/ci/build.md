# Build Pipeline

The build has one job: prove the solution compiles cleanly, is formatted, and passes its tests. All commands run from the repository root.

## Steps

```powershell
dotnet build src/YourApp.slnx
dotnet format src/YourApp.slnx --verify-no-changes
dotnet run --project src/YourApp.Search.Tests/YourApp.Search.Tests.csproj
```

1. `dotnet build` compiles every project.
2. `dotnet format --verify-no-changes` fails when any file deviates from `.editorconfig`.
3. Tests run per test project.

Run `dotnet format` locally after editing `.cs` files so CI does not reject the change.

## Zero warnings

Set `TreatWarningsAsErrors` once in `Directory.Build.props`:

```xml
<Project>
  <PropertyGroup>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
</Project>
```

!!! danger "Never add NoWarn"
    The build must stay at 0 warnings. Fix the cause. Do not add `<NoWarn>`, `#pragma warning disable`, or `.editorconfig` severity downgrades to make a warning go away.

Warnings as errors also gives you compile-time guarantees for patterns like exhaustive `switch` expressions (a missing arm is CS8509).

## Tests: dotnet run, not dotnet test

xUnit v3 test projects are executables on Microsoft.Testing.Platform. Run them with `dotnet run`.

```powershell
dotnet run --project src/YourApp.Download.Tests/YourApp.Download.Tests.csproj
```

!!! note
    `dotnet test` is the VSTest entry point and is not the supported path for xUnit v3 on Microsoft.Testing.Platform. Pass extra options after `--`, for example `-- --report-trx`.

In test code, pass `TestContext.Current.CancellationToken` to every call that accepts a `CancellationToken` (analyzer xUnit1051). The code fix can apply this:

```powershell
dotnet format analyzers src/YourApp.slnx --diagnostics xUnit1051 --severity info
```

## Coverage and quality gate

| Signal | Role |
|--------|------|
| Code coverage | Collected and reported, **not a gate** |
| Mutation testing | **The quality gate** |

Coverage only shows which lines ran. Mutation testing shows whether the tests would notice a change in behavior. Do not set a minimum coverage threshold that fails the build, because it rewards assertion-free tests.

See [GitHub Actions](github-actions.md) for how mutation testing is scheduled.

## Checklist

- [x] Build and format run from the repo root
- [x] `TreatWarningsAsErrors` in `Directory.Build.props`
- [x] No `NoWarn` anywhere
- [x] Tests run with `dotnet run`
- [x] Coverage collected, mutation score is the gate
