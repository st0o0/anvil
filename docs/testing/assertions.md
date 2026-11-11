# Assertion Conventions

Patterns for xUnit assertions. The goal is failures that point at the cause and
assertions that cannot pass vacuously.

## Collections

### Single element

Use `Assert.Single` instead of indexing. It asserts the count and binds the element.

```csharp
var item = Assert.Single(results);
Assert.Equal("Tatort", item.Title);
```

### Count guard before indexing

When several elements are accessed by index, assert the count first. Otherwise a
wrong count surfaces as an `ArgumentOutOfRangeException`.

```csharp
Assert.Equal(2, list.Count);
Assert.Equal("a", list[0].Name);
Assert.Equal("b", list[1].Name);
```

## Nullability

### No `!.` in tests

Do not use the null-forgiving operator to reach into nullable values. Assert
non-null first, then access members cleanly.

```csharp
var entry = result.Entry;
Assert.NotNull(entry);
Assert.Equal("x", entry.Name);
```

!!! note "Exception"
    XLinq `element.Attribute("x")!.Value` is accepted.

### No vacuous assertions

Once a value is already proven non-null and of the right type (for example by
`ExpectMsg<T>()`), the next assertion must inspect actual content.
`Assert.NotNull` as a guard before property assertions is still fine.

```csharp
var msg = probe.ExpectMsg<DownloadCompleted>();
Assert.Equal(expectedId, msg.DownloadId);   // content, not another NotNull
```

## Values

!!! warning "\"Not null\" and \"not empty\" are almost never enough"
    When behavior produces a concrete value (a string, a count, a computed
    field), assert that exact value.

```csharp
Assert.Equal("S01E02 - Pilot", name);        // good
Assert.False(string.IsNullOrEmpty(name));    // weak
```

Prefer `Assert.Equal(expected, actual)` over `Assert.True(actual == expected)`;
the failure message then shows both values.

## Exceptions

Capture the exception and inspect its fields, not only its type.

```csharp
var ex = Assert.Throws<ArgumentOutOfRangeException>(() => sut.Map(Kind.Unknown));
Assert.Equal("value", ex.ParamName);
Assert.Contains("Unknown", ex.Message);

var asyncEx = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.RunAsync());
```

## Mocks

Specify exact arguments and call count (NSubstitute).

```csharp
files.Received(1).Delete(Arg.Is<string>(p => p.EndsWith("a.mkv")));
files.DidNotReceive().Delete(Arg.Is<string>(p => p.EndsWith("b.mkv")));
```

"Was called" or "did not throw" is not a verification.

## Types

Use `exactMatch: false` to prove interface or base-type conformance instead of an
unchecked cast.

```csharp
var handler = Assert.IsType<FooHandler>(obj);                   // exact type
var conforming = Assert.IsType<IFoo>(obj, exactMatch: false);   // interface/base
```

## Grouped assertions

Use `Assert.Multiple` for several assertions on the same object so one run
reports every failure.

```csharp
Assert.Multiple(
    () => Assert.Equal("Show", dto.Title),
    () => Assert.Equal(3, dto.Season),
    () => Assert.Equal(7, dto.Episode));
```

## Theories vs facts

| Use | When |
|-----|------|
| `[Theory]` + `[InlineData]` / `[MemberData]` | Small input/output sweeps with the same shape |
| Separate `[Fact]`s | Each case needs a large, distinct fixture (e.g. an embedded JSON payload) |

A readable failure name beats DRY when fixtures are large.

```csharp
[Theory]
[InlineData(0, false)]
[InlineData(1, true)]
[InlineData(100, true)]
public void IsValid_Boundaries(int value, bool expected)
    => Assert.Equal(expected, Validator.IsValid(value));
```
