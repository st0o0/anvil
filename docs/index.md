# Anvil

Opinionated .NET & Akka.NET conventions — forged from real projects, real mistakes, and real corrections.

## What this is

A living reference of conventions, patterns, and anti-patterns for .NET services built on Akka.NET. Every rule here was learned the hard way: by building it wrong first, finding the root cause, and establishing the convention so it doesn't happen again.

These conventions cover:

- **C# fundamentals** — naming, type design, enums, async patterns
- **Akka.NET** — actor design, state management, messaging, persistence, streams
- **API design** — Minimal API endpoints, models, mapping
- **Testing** — philosophy, assertions, actor testing, mutation testing
- **DI & configuration** — options pattern, validation
- **Observability** — metrics, logging
- **CI/CD** — build pipeline, warnings-as-errors

## Philosophy

### Fix the root cause, not the symptom

When an actor crashes, find out **why** it crashes. Don't add a watchdog that restarts it. Don't wrap it in a try-catch. Don't add a workaround that hides the problem. Workarounds compound — every one you add makes the next bug harder to find.

### Less is more

Before adding a framework, abstraction, or helper: do you actually need it? Three similar lines are better than a premature abstraction. A flat stream is better than a custom GraphStage. A direct `switch` is better than an AutoMapper config.

### Types over strings

If a value comes from a known set, it's an enum. If a record carries structured data, it has typed properties. Strings are for free-form text, display values, and external API boundaries — nowhere else.

### Think before building

Design the solution end-to-end before writing code. Consider how it will be tested, how it will fail, and how it will be extended. A 20-minute design discussion saves 2 hours of rework.

### FunkArr as reference implementation

Throughout these docs, patterns reference a real project architecture. The conventions aren't theoretical — they're extracted from a working system with ~1200 tests across 11 test projects.

## How to use this

- **Starting a new project?** Read [Project Scaffolding](getting-started/project-scaffolding.md) and [Solution Structure](getting-started/solution-structure.md).
- **Writing an actor?** Read [Actor Design](akka/actor-design.md), [State Management](akka/state-management.md), and [Messaging](akka/messaging.md).
- **Writing tests?** Read [Philosophy](testing/philosophy.md) first, then the specific testing page.
- **Adding an API endpoint?** Read [Minimal API Endpoints](api/minimal-api.md).
- **Not sure about a pattern?** Search — every convention includes the anti-pattern it replaces and the reason it exists.
