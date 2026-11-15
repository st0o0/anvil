---
title: "GitHub Actions"
---

Workflows are split by cost: fast checks on every change, slow checks on a schedule. All CI workflows call reusable workflows from [github-workflows](https://github.com/st0o0/github-workflows) - pin to a major version tag (e.g. `@v1`).

The template repositories ([dotnet.application](https://github.com/st0o0/dotnet.application), [dotnet.library](https://github.com/st0o0/dotnet.library)) ship with these workflows pre-configured. You should not need to write them from scratch.

## Reusable workflows

| Workflow | Purpose |
|----------|---------|
| `dotnet-ci.yml` | Build, test, security (Trivy and CodeQL) |
| `dotnet-release-docker.yml` | Per-RID publish, multi-arch Docker, cosign signing |
| `dotnet-release-nuget.yml` | Build, test, pack, NuGet push, GitHub Release asset |
| `dotnet-dev-build.yml` | Label-gated PR dev image (per-RID, multi-arch) |
| `commitlint.yml` | Commit message validation via Conventional Commits |
| `security.yml` | Trivy Docker image scan with SARIF upload |
| `labeler.yml` | Path-based PR labeling |
| `labels.yml` | Label definition sync |

## CI workflow

Runs build, format check, and tests on every push and pull request.

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  ci:
    uses: st0o0/github-workflows/.github/workflows/dotnet-ci.yml@v1
    with:
      solution-file: src/ProjectName.slnx
```

The `dotnet-ci` workflow reads the SDK version from `global.json` so CI and local development use the same SDK. See [Build Pipeline](build) for the commands themselves.

## Release architecture

Use release-please to create releases from Conventional Commits, then chain build and publish jobs.

```yaml
name: release
on:
  push:
    branches: [main]

permissions:
  contents: write
  packages: write
  id-token: write

jobs:
  release-please:
    uses: st0o0/github-workflows/.github/workflows/release-please.yml@v1

  docker:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    uses: st0o0/github-workflows/.github/workflows/dotnet-release-docker.yml@v1
    with:
      version: ${{ needs.release-please.outputs.version }}
      image-name: projectname
      image-description: "Project description"
```

For NuGet libraries, replace the docker job with `dotnet-release-nuget.yml`:

```yaml
  nuget:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    uses: st0o0/github-workflows/.github/workflows/dotnet-release-nuget.yml@v1
    with:
      version: ${{ needs.release-please.outputs.version }}
      solution-file: src/ProjectName.slnx
      publish-project: src/ProjectName/ProjectName.csproj
      package-name: ProjectName
    secrets:
      NUGET_USER: ${{ secrets.NUGET_USER }}
```

:::tip
The release workflow runs release-please first, then only chains build/publish when `release_created` is true. This avoids the GITHUB_TOKEN limitation where workflow-created releases do not trigger `on: release`.
:::

## Mutation testing

:::caution[Schedule it, do not run it on PRs]
Mutation testing is too slow for pull requests. Run it weekly on a schedule and allow manual dispatch.
:::

Use a matrix with one job per target project so jobs run in parallel and one failing target does not hide the others.

```yaml
name: mutation
on:
  schedule:
    - cron: "0 3 * * 0"
  workflow_dispatch:

jobs:
  mutate:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        target: [Search, Download, Scoring, Feed]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          global-json-file: global.json
      - run: dotnet tool restore
      - run: dotnet stryker --config-file src/ProjectName.${{ matrix.target }}.Tests/stryker-config.json
      - uses: actions/upload-artifact@v4
        with:
          name: mutation-${{ matrix.target }}
          path: "**/StrykerOutput/**/reports/*"
```

## Security scanning

The `security.yml` workflow scans Docker images with Trivy and uploads results to the GitHub Security tab.

```yaml
  security:
    uses: st0o0/github-workflows/.github/workflows/security.yml@v1
    with:
      docker-image-name: projectname
```

## Docker image build (PR dev builds)

Label-gated dev image builds on PRs, useful for testing changes in a staging environment.

```yaml
  dev-build:
    uses: st0o0/github-workflows/.github/workflows/dotnet-dev-build.yml@v1
    with:
      image-name: projectname
```

## Do not push results to the repo

:::danger
Never commit test results, coverage reports, or mutation reports back to the repository from a workflow. They create noisy history and merge conflicts.
:::

Upload them as workflow artifacts (`actions/upload-artifact`) or publish to a report site instead.

## Permissions

The calling job must declare its own `permissions:` block. Without it, the reusable workflow run fails with `Invalid workflow file`.

## Checklist

- [x] CI on every push and PR via `dotnet-ci.yml`
- [x] Releases via release-please + chained build/publish
- [x] Commit messages enforced via `commitlint.yml`
- [x] Mutation testing weekly, matrix per target
- [x] Security scanning via `security.yml`
- [x] Reports as artifacts, never committed
- [x] All workflows pinned to `@v1` from [github-workflows](https://github.com/st0o0/github-workflows)
