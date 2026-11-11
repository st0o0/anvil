# Testing Philosophy

Tests exist to pin down behavior and catch regressions. They do not exist to
satisfy a coverage number. Every convention on the following pages follows from
this idea.

## Test behavior, not coverage

!!! warning "A test that only checks \"it didn't throw\" is worse than no test"
    It executes code, raises the coverage figure, and proves nothing. It gives
    false confidence and makes later refactors look safe when they are not.

```csharp
// Bad: executes the code, asserts nothing about the outcome
[Fact]
public void Score_DoesNotThrow()
{
    var ex = Record.Exception(() => _engine.Score(input));
    Assert.Null(ex);
}

// Good: pins the computed behavior
[Fact]
public void Score_TitleAndYearMatch_ReturnsFullScore()
{
    var result = _engine.Score(input);
    Assert.Equal(100, result.Value);
}
```

## Do not chase 100%

Spend effort where bugs actually hide.

| Test | Skip |
|------|------|
| Pure logic: scoring engines, parsers, validators, state machines | DI wiring and container registration |
| Mapping correctness (domain <-> DTO, enum switches) | Configuration binding |
| Edge cases in business rules (boundaries, empty input, ordering) | Trivial getters/setters and plain records |

## Tests fail for the right reason

When a test fails, the failure message alone should tell you what broke.

- One logical behavior per test, named after that behavior.
- Assert the exact expected value so the diff is meaningful.
- Prefer `Assert.Equal(expected, actual)` over `Assert.True(...)` (see [Assertions](assertions.md)).
- A test that can fail for several unrelated reasons is two tests.

## Mutation testing reveals weak tests

If a mutation tool can change `>` to `>=` and your suite stays green, the test
does not check what you think it checks. Use [mutation testing](mutation-testing.md)
on pure logic to find boundary conditions that no test pins down.

## One test class per production class

- `FooEngine` is tested by `FooEngineTests`, in the same relative folder.
- No shared base test classes with inherited tests. Inherited tests hide what is
  actually being run and make failures hard to trace.
- Small shared helpers (builders, fixtures) are fine; shared *test cases* are not.

## No `Thread.Sleep`

Never wait for async or eventually-consistent state with a fixed delay. It is
slow when the system is fast and flaky when it is slow.

!!! tip "Use bounded waits with descriptive failures"
    Use `AwaitAssert`, `TestProbe.ExpectMsg`, or an equivalent polling helper
    with an explicit timeout. When it times out, the failure message must say
    what was being waited for. Actor tests get this for free, see
    [Actor Testing](actor-testing.md).

## Quality bar

Reference point: a mature codebase of roughly 1200 tests across 11 test
projects, all passing, all meaningful. No test exists just because a metric
asked for one. If you cannot say what regression a test would catch, delete it.

## Checklist

- [ ] Does the test assert an observable outcome, not just absence of exceptions?
- [ ] Would a plausible bug in the production code make it fail?
- [ ] Is the failure message self-explanatory?
- [ ] Is there one test class per production class, with no inherited test cases?
- [ ] Are there zero `Thread.Sleep` or arbitrary delays?
