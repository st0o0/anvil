# Actor State Pattern

The "Pathfinder pattern": all mutable domain state lives in a dedicated state class. The actor only routes messages and calls `Apply`.

## Rules

1. State is a `sealed class` in its own `<Actor>State.cs` file. Not a record, not nested in the actor.
2. Mutable collections (`List<T>`, `Dictionary<K,V>`, `HashSet<T>`) are fine. Akka's single-threaded mailbox guarantees safe mutation.
3. Every public mutation method is named `Apply`, overloaded by parameter type. Never `ApplyFoo` / `ApplyBar`.
4. For primitives or multiple values, add a small wrapper record next to the state class and use `Apply(WrapperRecord)`.
5. `Empty` is a property, never a shared static field.
6. State is never sent to callers. Use `GetSnapshot()` to produce a response record and `FromSnapshot()` to reconstruct.
7. Persistent actors add `GetPersistenceState()` and `FromPersistence()`.
8. No domain fields on the actor (dictionaries, flags, counters). Infrastructure refs (actor refs, `CancellationTokenSource`, stopwatches) may stay on the actor.

## Correct

```csharp
public sealed class CartState
{
    private readonly Dictionary<Guid, int> _items = new();
    public bool CheckedOut { get; private set; }

    public static CartState Empty => new();

    public void Apply(ItemAdded evt) =>
        _items[evt.ProductId] = _items.GetValueOrDefault(evt.ProductId) + evt.Quantity;

    public void Apply(CheckedOut _) => CheckedOut = true;

    // wrapper record for multiple values
    public void Apply(QuantityChange change) => _items[change.ProductId] = change.Quantity;

    public CartSnapshot GetSnapshot() => new(_items.ToImmutableDictionary(), CheckedOut);

    public static CartState FromSnapshot(CartSnapshot s)
    {
        var state = new CartState { CheckedOut = s.CheckedOut };
        foreach (var (id, qty) in s.Items) state._items[id] = qty;
        return state;
    }
}

public sealed record QuantityChange(Guid ProductId, int Quantity);
```

## Persistent variant

```csharp
public PersistedCartState GetPersistenceState() => new(_items.ToDictionary(), CheckedOut);

public static CartState FromPersistence(PersistedCartState p)
{
    var state = new CartState { CheckedOut = p.CheckedOut };
    foreach (var (id, qty) in p.Items) state._items[id] = qty;
    return state;
}
```

See [Persistence](persistence.md) for how these hook into `Persist` and `SaveSnapshot`.

## Anti-patterns

!!! warning "Leaked state on the actor"
    ```csharp
    public sealed class CartActor : ReceiveActor
    {
        private readonly Dictionary<Guid, int> _items = new(); // domain state on actor
        private bool _checkedOut;                              // flag on actor
        private int _retries;                                  // counter on actor
    }
    ```
    The actor now owns domain logic that cannot be unit-tested without an `ActorSystem`.

!!! warning "Misnamed or nested state"
    ```csharp
    public sealed class CartActor
    {
        private sealed record State(ImmutableList<Item> Items);   // nested record
    }

    public sealed class CartState
    {
        public void ApplyItemAdded(ItemAdded e) { }   // not named Apply
        public void ApplyCheckedOut() { }
        public static readonly CartState Empty = new(); // shared mutable instance
    }
    ```
    A shared static `Empty` is a mutable instance reused across actors: one actor's mutation corrupts the next.

!!! warning "Sending state to callers"
    ```csharp
    Receive<QueryCart>(_ => Sender.Tell(_state)); // caller now holds a mutable reference
    ```
    Reply with `_state.GetSnapshot()` instead.

!!! tip "Why a class and not a record?"
    The state mutates in place and is touched only from the actor's mailbox. Records with
    `with` expressions allocate on every event and encourage leaking immutable-looking
    copies that are never actually shared.

## Testing benefit

State classes are plain objects. Test them directly without an actor system:

```csharp
[Fact]
public void Apply_ItemAdded_AccumulatesQuantity()
{
    var state = CartState.Empty;
    state.Apply(new ItemAdded(id, 2));
    state.Apply(new ItemAdded(id, 3));
    Assert.Equal(5, Assert.Single(state.GetSnapshot().Items).Value);
}
```
