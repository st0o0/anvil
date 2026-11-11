# Solution Structure

A multi-project solution with strict domain isolation. Structure is enforced by architecture tests, not by convention alone.

## Layout

```
src/
  YourApp.slnx
  YourApp/                   # Host
  YourApp.Core/              # Common types, framework refs
  YourApp.Messages/          # Commands, queries, responses
  YourApp.Persistence/       # Versioned DTOs
  YourApp.Api/               # Internal REST API
  YourApp.Search/            # Domain
  YourApp.Download/          # Domain
  YourApp.Scoring/           # Domain
  YourApp.Search.Tests/
  YourApp.Download.Tests/
  YourApp.Architecture.Tests/
  YourApp.Tests.Shared/
```

## Projects

| Project | Responsibility |
|---------|----------------|
| Host | `Program.cs`, startup, DI composition, configuration |
| Core | Common types and framework references (Akka, etc.). References Messages and Persistence |
| Messages | Commands, queries, responses for all domains |
| Persistence | DTOs. Extend-only, versioned records |
| Domain projects | One per bounded context. No references to each other |
| API project(s) | Thin adapter layer that translates protocols to messages |
| Test projects | One per domain project, mirroring its folder structure |
| Architecture.Tests | ArchUnitNET structural rules |
| Tests.Shared | Shared test infrastructure |

## Reference direction

```
Host -> API -> Domains -> Core -> Messages / Persistence
```

!!! danger "Never upward, never cross-domain"
    A project may only reference projects to its right. Domain projects never reference each other. They communicate only through messages defined in `Messages`.

- **Core bundles framework references.** It declares the framework NuGet packages so domain projects reference only Core.
- **API projects are thin adapters.** They translate external protocols into domain commands and queries. No business logic.
- **Persistence DTOs are extend-only.** Add members, never rename or remove, so stored data stays readable.

## Domain isolation

Two domains that need to talk do it through a message contract:

```csharp
// YourApp.Messages
public sealed record QueryRuleSet(string RuleSetId);

// YourApp.Search sends it, YourApp.RuleSet handles it.
// Neither project references the other.
```

If two domains need the same type, it belongs in Messages (for contracts) or Core (for common utilities), not in one domain.

## Tests

- One test project per domain project: `YourApp.Search` is tested by `YourApp.Search.Tests`.
- Test folders mirror the source folders, so finding a test is mechanical.
- Shared fixtures and helpers live in `Tests.Shared`, referenced only by test projects.

## Architecture tests

Use ArchUnitNET to enforce the rules above so violations fail the build.

```csharp
[Fact]
public void Domains_do_not_reference_each_other()
{
    var rule = Types().That().ResideInNamespace("YourApp.Search")
        .Should().NotDependOnAny(Types().That().ResideInNamespace("YourApp.Download"));

    rule.Check(Architecture);
}
```

Typical rules: reference direction, naming conventions, domain boundaries, and sealed-by-default types.
