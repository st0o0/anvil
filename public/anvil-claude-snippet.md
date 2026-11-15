## Anvil Conventions

This project follows the [Anvil](https://anvil.st0o0.net) conventions for .NET and Akka.NET.

Rules: https://anvil.st0o0.net/anvil-conventions.md
Full reference with code examples: https://anvil.st0o0.net/llms-full.txt

Key principles:
- Actors are thin plumbing - all domain state in dedicated state classes
- `sealed` by default, `record` for messages/DTOs, composition over inheritance
- Tests pin behavior, not coverage - assert outcomes, not absence of exceptions
- Zero warnings policy, `dotnet format` enforced
