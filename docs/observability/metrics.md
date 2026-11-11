# Metrics Conventions

Metrics use `System.Diagnostics.Metrics` with one meter per domain, exported through OpenTelemetry to Prometheus.

## Telemetry class per domain

Each domain has a static `Telemetry` class with an `internal static readonly Meter` named `YourApp.<Domain>` and `internal static readonly` instruments.

```csharp
internal static class Telemetry
{
    internal static readonly Meter Meter = new("YourApp.Download");

    internal static readonly Counter<long> Completed =
        Meter.CreateCounter<long>("yourapp.download.completed_total");

    internal static readonly Counter<long> Failed =
        Meter.CreateCounter<long>("yourapp.download.failed_total");

    internal static readonly Histogram<double> Duration =
        Meter.CreateHistogram<double>("yourapp.download.duration_seconds", unit: "s");

    private static int _queueSize;

    internal static readonly ObservableGauge<int> QueueSize =
        Meter.CreateObservableGauge("yourapp.download.queue_size", () => _queueSize);

    internal static void SetQueueSize(int value) => _queueSize = value;
}
```

!!! note "No abstraction"
    No base class, no shared `IMetrics` wrapper, no generic helper for meters. Each domain's `Telemetry` class is plain static code.

## Registration

Register every meter centrally in the telemetry setup, then export with Prometheus.

```csharp
services.AddOpenTelemetry()
    .WithMetrics(m => m
        .AddMeter("YourApp.Download")
        .AddMeter("YourApp.Search")
        .AddPrometheusExporter());
```

A meter that is not registered emits nothing, so add the `.AddMeter(...)` line in the same change that creates the meter.

## Naming

| Element | Rule | Example |
|---------|------|---------|
| Meter | `YourApp.<Domain>` | `YourApp.Download` |
| Instrument | `yourapp.<domain>.<metric_name>` in snake_case | `yourapp.download.duration_seconds` |
| Counter | ends with `_total` | `yourapp.search.requests_total` |
| Time histogram | ends with `_seconds` | `yourapp.search.duration_seconds` |

## Tags

- Short, lowercase names: `reason`, `source`, `type`, `status`, `phase`.
- Cardinality must stay bounded.

!!! danger "Never use unbounded values as tags"
    Entity IDs, file names, URLs, and query strings create one time series per value and will overwhelm the metrics backend. Map them to a small fixed set (`reason=timeout`) instead.

```csharp
Telemetry.Failed.Add(1, new KeyValuePair<string, object?>("reason", "timeout"));
```

## ObservableGauge

Use a static backing field with an `internal static void Set*()` setter. The actor (or service) calls the setter when the value changes. The gauge callback only reads the field.

This keeps the gauge callback free of actor state access and thread-safety concerns.

## Instrument at the operation boundary

Record metrics where the operation completes, success or failure, not at each call site that starts it.

```csharp
// Good: one place, covers every path
private void Complete(Stopwatch sw, bool ok)
{
    Telemetry.Duration.Record(sw.Elapsed.TotalSeconds);
    (ok ? Telemetry.Completed : Telemetry.Failed).Add(1);
}
```

This prevents double counting and missed failure paths when an operation has several entry points.
