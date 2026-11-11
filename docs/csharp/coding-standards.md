# C# Coding Standards

Formatting and style rules enforced by tooling. If a rule is not machine-checked, it is still expected in review.

## Formatting

- Allman style braces: the opening brace goes on its own line.
- 4 spaces indentation, no tabs.
- Sort `using` directives with `System.*` first, then the rest alphabetically.

```csharp
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Acme.Billing;

public sealed class InvoiceService
{
    public void Send(Invoice invoice)
    {
        if (invoice.IsEmpty)
        {
            return;
        }
    }
}
```

## Naming

| Member | Style | Example |
|--------|-------|---------|
| Public / protected members | `PascalCase` | `TotalAmount` |
| Private instance fields | `_camelCase` | `_clock` |
| `const` fields (any accessibility) | `PascalCase` | `MaxRetries` |
| Locals, parameters | `camelCase` | `invoiceId` |

```csharp
public sealed class RetryPolicy
{
    private const int MaxRetries = 3;
    private readonly TimeProvider _clock;

    public RetryPolicy(TimeProvider clock)
    {
        _clock = clock;
    }
}
```

## Language usage

- Use `var` when the type is apparent from the right-hand side.
- No `this.` qualifier unless it is necessary to disambiguate.
- Classes are `sealed` by default. Unseal only for a concrete need.
- Use `record` for messages, DTOs and value objects.
- Nullable reference types are enabled in every project.

```csharp
var items = new List<InvoiceLine>();      // type is apparent
IReadOnlyList<InvoiceLine> lines = items; // type is not apparent, state it
```

## Documentation

No XML docs. Names carry the meaning; if a member needs a comment to be understood, rename it.

!!! tip
    Use a comment only to explain *why* something non-obvious is done, never *what* it does.

## Tooling

`dotnet format` is enforced and CI rejects violations. Run it after editing `.cs` files.

```powershell
dotnet format MySolution.slnx --verify-no-changes
```

!!! warning "Never modify `.editorconfig` to silence warnings"
    The `.editorconfig` defines the rules of the codebase. When it reports a naming or style violation, fix the code to match. Loosening the rule, lowering severity, or adding suppressions is not an acceptable fix.

### Warnings as errors

`TreatWarningsAsErrors` is on for all projects, set once in `Directory.Build.props`:

```xml
<Project>
  <PropertyGroup>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
</Project>
```

The build must stay at 0 warnings.

!!! warning "Do not add `NoWarn`"
    Fix the cause of the warning. `NoWarn` and `#pragma warning disable` hide real problems and accumulate as debt.
