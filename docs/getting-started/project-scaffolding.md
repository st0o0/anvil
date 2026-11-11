# Project Scaffolding

Root-level files that every solution starts with. They define the SDK, shared build settings, package versions, and code style once for all projects.

## Layout

```
repo/
  global.json
  .editorconfig
  .config/
    dotnet-tools.json
  src/
    YourApp.slnx
    Directory.Build.props
    Directory.Packages.props
    YourApp/
    YourApp.Core/
```

## Solution format: .slnx

Use the `.slnx` XML solution format. It is human-readable, diff-friendly, and avoids the GUID noise of `.sln`.

```xml
<Solution>
  <Folder Name="/src/">
    <Project Path="YourApp/YourApp.csproj" />
    <Project Path="YourApp.Core/YourApp.Core.csproj" />
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

!!! tip
    Use `dotnet add package` / `dotnet remove package` rather than editing XML by hand. Use shared version properties for related packages that must move together.

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

The `.editorconfig` defines code style and naming rules, enforced by `dotnet format` in CI.

!!! danger "Never modify .editorconfig to silence warnings"
    The file defines the project's rules. Fix the code to match it. Changing a rule to make a warning disappear defeats the purpose of having one.

## Local tools

Declare tools in `.config/dotnet-tools.json` so everyone (and CI) uses the same versions.

```json
{
  "version": 1,
  "isRoot": true,
  "tools": {
    "dotnet-stryker": { "version": "4.0.0", "commands": ["dotnet-stryker"] },
    "dotnet-reportgenerator-globaltool": { "version": "5.3.0", "commands": ["reportgenerator"] }
  }
}
```

Restore with `dotnet tool restore`. `dotnet format` ships with the SDK, so it needs no manifest entry.
