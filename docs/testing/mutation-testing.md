# Mutation Testing with Stryker.NET

Mutation testing changes production code in small ways (`>` to `>=`, `+` to `-`,
a removed statement) and re-runs the tests. A mutant that survives means no test
noticed the change.

## Setup

Install Stryker.NET as a local tool so every developer and CI uses the same version.

```bash
dotnet new tool-manifest
dotnet tool install dotnet-stryker
```

## What to target

| Good targets (deterministic) | Avoid |
|------------------------------|-------|
| Scoring engines, parsers, validators | Actor tests: timing-sensitive, flaky mutations |
| State classes (`Apply`) | Architecture tests: no production logic |
| Mapping extensions | Persistence DTOs: extend-only records |
| | Streams: timing-dependent |

## Configuration

One `stryker-config.json` per test project.

```json
{
  "stryker-config": {
    "project": "MyApp.Scoring.csproj",
    "test-projects": ["../MyApp.Scoring.Tests/MyApp.Scoring.Tests.csproj"],
    "thresholds": { "high": 80, "low": 65, "break": 65 },
    "ignore-mutations": ["string"],
    "reporters": ["html", "progress", "json"],
    "mutate": ["!**/Telemetry.cs"]
  }
}
```

- `break: 65` fails the run when the score drops below it. Start there and raise it gradually.
- The `string` mutator is ignored because log and wire text mutations are noise.

## Equivalent mutants

Some mutants cannot be killed because the behavior is identical (for example
`i < n` versus `i != n` in a loop that cannot overshoot).

!!! warning "Do not weaken production code to kill a mutant"
    Document equivalent mutants explicitly (a list next to the config, or a
    `// Stryker disable once <mutator> : <reason>` comment) instead of
    restructuring correct code.

```csharp
// Stryker disable once Equality : loop bound is unreachable either way
for (var i = 0; i < items.Count; i++) { ... }
```

## Running

Locally, use a Docker container for a consistent environment:

```bash
docker run --rm -v "$PWD:/src" -w /src/src/MyApp.Scoring.Tests \
  mcr.microsoft.com/dotnet/sdk:10.0 \
  sh -c "dotnet tool restore && dotnet stryker -f stryker-config.json"
```

In CI, run the tool directly with `--local` where the job already has the SDK:

```bash
dotnet stryker -f stryker-config.json --local
```

## CI

Mutation runs are slow, so schedule them weekly and never on pull requests. Use
a matrix with one job per target project.

```yaml
name: mutation
on:
  schedule: [{ cron: "0 3 * * 0" }]
  workflow_dispatch:
jobs:
  stryker:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        project: [Scoring, Search, RuleSet]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: 10.0.x }
      - run: dotnet tool restore
      - working-directory: src/MyApp.${{ matrix.project }}.Tests
        run: dotnet stryker -f stryker-config.json --local
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: stryker-${{ matrix.project }}
          path: src/MyApp.${{ matrix.project }}.Tests/StrykerOutput
```

!!! tip "Workflow"
    Read the HTML report, pick surviving mutants in boundary logic first, add a
    test that pins the exact value, re-run. Treat the score as a signal, not a goal.
