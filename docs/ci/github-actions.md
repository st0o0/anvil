# GitHub Actions

Workflows are split by cost: fast checks on every change, slow checks on a schedule.

## CI workflow

Runs build, format check, and tests on every push and pull request.

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          global-json-file: global.json
      - run: dotnet build src/YourApp.slnx --configuration Release
      - run: dotnet format src/YourApp.slnx --verify-no-changes
      - run: dotnet run --project src/YourApp.Search.Tests/YourApp.Search.Tests.csproj --configuration Release
```

Read the SDK version from `global.json` so CI and local development use the same SDK. See [Build Pipeline](build.md) for the commands themselves.

## Mutation testing

!!! warning "Schedule it, do not run it on PRs"
    Mutation testing is too slow for pull requests. Run it weekly on a schedule and allow manual dispatch.

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
      - run: dotnet stryker --config-file src/YourApp.${{ matrix.target }}.Tests/stryker-config.json
      - uses: actions/upload-artifact@v4
        with:
          name: mutation-${{ matrix.target }}
          path: "**/StrykerOutput/**/reports/*"
```

## Docker image build and scan

Build the image on pull requests (without pushing) and on main (with push), and scan it.

```yaml
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          tags: yourapp:ci
          load: true
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: yourapp:ci
          severity: CRITICAL,HIGH
          exit-code: "1"
```

| Tool | Checks |
|------|--------|
| Hadolint | Dockerfile lint and best practices |
| Trivy | Vulnerabilities in the image and its OS and package layers |

Pin third-party actions to a version or digest rather than a moving branch where possible.

## Do not push results to the repo

!!! danger
    Never commit test results, coverage reports, or mutation reports back to the repository from a workflow. They create noisy history and merge conflicts.

Upload them as workflow artifacts (`actions/upload-artifact`) or publish to a report site instead.

## Checklist

- [x] CI on every push and PR: build, format, tests
- [x] Mutation testing weekly, matrix per target
- [x] Hadolint and Trivy on the image
- [x] Reports as artifacts, never committed
