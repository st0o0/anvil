# Architecture Tests with ArchUnitNET

Architecture tests turn structural conventions into failing builds. They live in
a dedicated project (for example `MyApp.Architecture.Tests`) and use
[ArchUnitNET](https://github.com/TNG/ArchUnitNET).

## What to enforce

- Reference direction
- Domain isolation
- Naming conventions
- One class per file

## Loading the architecture

```csharp
internal static class ArchitectureFixture
{
    public static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(
            typeof(MyApp.Core.CoreMarker).Assembly,
            typeof(MyApp.Search.SearchMarker).Assembly,
            typeof(MyApp.Download.DownloadMarker).Assembly)
        .Build();
}
```

## Reference direction

The allowed direction is `Host -> API -> Domains -> Core -> Messages/Persistence`.
Never upward.

```csharp
[Fact]
public void Core_DoesNotDependOnDomains()
{
    var core = Types().That().ResideInNamespaceMatching(@"MyApp\.Core(\..*)?").As("Core");
    var domains = Types().That().ResideInNamespaceMatching(@"MyApp\.(Search|Download)(\..*)?");

    core.Should().NotDependOnAny(domains).Check(ArchitectureFixture.Architecture);
}
```

## Domain isolation

Domain projects must not reference each other. They communicate only through
messages.

```csharp
[Theory]
[InlineData("Search", "Download")]
[InlineData("Download", "Search")]
public void Domains_DoNotReferenceEachOther(string from, string to)
{
    Types().That().ResideInNamespaceMatching($@"MyApp\.{from}(\..*)?")
        .Should().NotDependOnAny(Types().That().ResideInNamespaceMatching($@"MyApp\.{to}(\..*)?"))
        .Check(ArchitectureFixture.Architecture);
}
```

## Naming conventions

| Kind | Rule |
|------|------|
| Actors | `*Manager` (singleton), `*Worker` (entity), `*Actor` (other); derive from an actor base |
| Messages | Commands `VerbNoun`, queries `QueryNoun`, events past tense |
| State | `<Actor>State`, sealed class |

```csharp
[Fact]
public void ManagerClasses_AreActors()
{
    Classes().That().HaveNameEndingWith("Manager")
        .Should().BeAssignableTo(typeof(ActorBase))
        .Check(ArchitectureFixture.Architecture);
}
```

## One class per file

ArchUnitNET inspects compiled types, so enforce this with a small file-based
test or an analyzer rule (for example IDE0065 / a Roslyn analyzer) rather than
the architecture model.

!!! note "Allowed exceptions"
    Small wrapper records next to their state class and a command with its
    response records are deliberate groupings; whitelist them explicitly.

## Do not over-constrain

!!! warning
    Keep the rules at the same level of detail as the reference project. Every
    rule should encode a decision the team actually made and would defend.
    Rules that block legitimate refactors, or that restate what the compiler
    already enforces, create friction and get disabled.

- Prefer a few rules on stable boundaries over many on incidental structure.
- Failure messages should name the rule (`.As("...")` / `Because("...")`).
- Never fix a violation by weakening the rule; fix the code or change the decision.
