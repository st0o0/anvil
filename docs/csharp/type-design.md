# Type Design

Choose the type kind by what the type is for. The defaults below keep types small, safe to share, and cheap to reason about.

## Choosing a type kind

| Purpose | Type |
|---------|------|
| Messages, DTOs, API models, persistence events | `sealed record` |
| Small value objects passed around often | `readonly record struct` |
| Mutable state owned by one component | `sealed class` |
| Behavior with dependencies | `sealed class` |

## Records for data

```csharp
public sealed record InvoiceCreated(
    Guid InvoiceId,
    string Customer,
    IReadOnlyList<InvoiceLine> Lines);
```

Messages and DTOs carry immutable data. Use immutable or read-only collection types (`IReadOnlyList<T>`, `ImmutableArray<T>`) in their signatures.

## Value objects

Small, frequently passed values are `readonly record struct`. Equality and `with` come for free, and there is no heap allocation.

```csharp
public readonly record struct Money(decimal Amount, string Currency);

public readonly record struct CustomerId(Guid Value);
```

!!! tip
    Wrap primitive identifiers in a value object so `CustomerId` and `InvoiceId` cannot be swapped by accident.

Use `readonly struct` (not `record struct`) when you need custom equality or no generated members. Keep structs small, ideally 16 bytes or less.

## Seal everything

Classes and records are `sealed` by default. Unseal only when you have a concrete, current need for a subclass.

```csharp
public sealed class PriceCalculator { }
public sealed record OrderPlaced(Guid OrderId);
```

Sealed types are faster to dispatch, cannot be extended in ways you did not design for, and make the intent explicit.

## Composition over inheritance

Do not build inheritance hierarchies for domain types. Compose behavior from small collaborators instead.

```csharp
// Avoid
public abstract class Document { }
public class Invoice : Document { }
public class CreditNote : Invoice { }

// Prefer
public sealed class Invoice
{
    private readonly ITaxPolicy _tax;
    private readonly INumbering _numbering;

    public Invoice(ITaxPolicy tax, INumbering numbering)
    {
        _tax = tax;
        _numbering = numbering;
    }
}
```

!!! warning
    A base class is a public contract with every future subclass. Prefer interfaces for polymorphism and records for data.

## Mutable state classes

State owned by a single-threaded component (for example an actor, whose mailbox serializes access) uses mutable collections directly. No locking or immutable copies are needed.

```csharp
public sealed class OrderState
{
    private readonly Dictionary<Guid, OrderLine> _lines = [];
    private readonly HashSet<string> _tags = [];

    public void Apply(LineAdded evt)
    {
        _lines[evt.LineId] = new OrderLine(evt.Sku, evt.Quantity);
    }
}
```

!!! warning
    Mutable collections must never leave the owning component. Expose a snapshot as an immutable record instead.

## No god classes

When a class has too many responsibilities, split by concern, not by size. Line count is a symptom; mixed reasons to change are the cause.

- One reason to change per class.
- Extract collaborators for distinct concerns (validation, mapping, persistence, orchestration).
- Do not create `Helper` or `Utils` classes as a dumping ground.
