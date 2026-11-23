---
title: "Project Scaffolding"
---

Every new project starts from one of the template repositories. They include the root-level files, CI workflows, and tooling described below - so you get a working setup without manual assembly.

## Template repositories

| Template | Use for | Create |
|----------|---------|--------|
| [dotnet.application](https://github.com/st0o0/dotnet.application) | Services, APIs, Akka.NET apps with Docker | "Use this template" on GitHub |
| [dotnet.library](https://github.com/st0o0/dotnet.library) | NuGet packages | "Use this template" on GitHub |

Both are GitHub template repositories. Click "Use this template" to create a new repo with the full structure, then rename `ProjectName` to your actual project name.

:::tip
Always start from a template. Do not create a new repo from scratch and copy files over - the templates carry CI, release automation, commit linting, and security scanning that are easy to miss.
:::

## What the templates include

### Root-level files

```text
repo/
  global.json
  .editorconfig
  CLAUDE.md
  .config/
    dotnet-tools.json
  .claude/
    settings.json
  .slopwatch/
    slopwatch.json
    baseline.json
  commitlint.config.mjs
  renovate.json
  release-please-config.json
  .release-please-manifest.json
  trivy.yaml
  src/
    ProjectName.slnx
    Directory.Build.props
    Directory.Packages.props
```

### CI and automation (pre-configured)

| File | Purpose |
|------|---------|
| `commitlint.config.mjs` | Enforces [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.) |
| `release-please-config.json` | Automatic versioning and changelog from commit messages |
| `renovate.json` | Automated dependency updates via Renovate |
| `trivy.yaml` | Container and dependency vulnerability scanning |

The CI workflows call reusable workflows from [github-workflows](https://github.com/st0o0/github-workflows). See [GitHub Actions](../ci/github-actions) for details.

## Solution format: .slnx

Use the `.slnx` XML solution format. It is human-readable, diff-friendly, and avoids the GUID noise of `.sln`.

```xml
<Solution>
  <Folder Name="/src/">
    <Project Path="ProjectName/ProjectName.csproj" />
    <Project Path="ProjectName.Core/ProjectName.Core.csproj" />
  </Folder>
</Solution>
```

## Directory.Build.props

Shared properties for every project in the tree.

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
</Project>
```

## Central Package Management

Versions live in `Directory.Packages.props`. Project files reference packages without versions.

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Akka" Version="1.5.0" />
    <PackageVersion Include="xunit.v3" Version="1.0.0" />
  </ItemGroup>
</Project>
```

:::tip
Use `dotnet add package` / `dotnet remove package` rather than editing XML by hand. Use shared version properties for related packages that must move together.
:::

## global.json

Pin the SDK so every machine and CI runner builds with the same version.

```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature"
  }
}
```

## .editorconfig

The `.editorconfig` defines code style and naming rules, enforced by `dotnet format` in CI. The templates ship with a complete `.editorconfig` that covers:

- File-scoped namespaces, explicit accessibility modifiers
- `_camelCase` for private fields, `PascalCase` for types and constants, `I` prefix for interfaces
- Braces always, readonly fields, collection expressions, null propagation
- Analyzer severities (IDE0005, CA2007, CA1852, etc.)
- Relaxed rules for test projects (CA1707, CA2007, CS1591 off)

:::danger[Never modify .editorconfig to silence warnings]
The file defines the project's rules. Fix the code to match it. Changing a rule to make a warning disappear defeats the purpose of having one.
:::

## Local tools

Declare tools in `.config/dotnet-tools.json` so everyone (and CI) uses the same versions.

```json
{
  "version": 1,
  "isRoot": true,
  "tools": {
    "slopwatch.cmd": { "version": "0.4.0", "commands": ["slopwatch"] },
    "dotnet-stryker": { "version": "4.0.0", "commands": ["dotnet-stryker"] },
    "dotnet-reportgenerator-globaltool": { "version": "5.3.0", "commands": ["reportgenerator"] }
  }
}
```

Restore with `dotnet tool restore`. `dotnet format` ships with the SDK, so it needs no manifest entry.

## Slopwatch (LLM anti-cheat)

The templates ship with [Slopwatch](https://github.com/st0o0/slopwatch) pre-configured in strict mode. It detects shortcuts that make builds pass without solving the underlying problem — disabled tests, warning suppression, empty catch blocks, arbitrary delays, and CPM bypasses.

### What's included

| File | Purpose |
|------|---------|
| `.config/dotnet-tools.json` | Slopwatch as a local tool |
| `.slopwatch/slopwatch.json` | Strict config — all rules at error severity |
| `.slopwatch/baseline.json` | Empty baseline for a fresh project |
| `.claude/settings.json` | Claude Code hook that validates every edit |
| `.github/workflows/ci.yml` | `slopwatch: true` enables it in the reusable workflow |

### Claude Code hook

The hook runs `slopwatch analyze --hook` after every file edit in a Claude Code session. If it flags an issue, the edit is blocked and Claude sees the error immediately.

### CI gate

The reusable `dotnet-ci.yml` workflow from [github-workflows](https://github.com/st0o0/github-workflows) has Slopwatch built in. The templates enable it with `slopwatch: true`. It runs `slopwatch analyze --fail-on error` in the lint job on every pull request.

:::danger[Never update the baseline to pass CI]
If Slopwatch flags something, fix the code. Only update `.slopwatch/baseline.json` when a third-party library forces a pattern, and document why in a code comment.
:::
