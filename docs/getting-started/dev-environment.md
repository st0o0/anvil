# Dev Environment

The application runs in Docker during development, together with the services it depends on. This keeps local behavior close to production.

## Docker Compose

Use a dedicated compose file for local development, containing the app plus its dependencies.

```yaml
# docker-compose.dev.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      Download__MaxParallel: "2"
    volumes:
      - ./data:/data
    depends_on:
      - db

  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: dev
    volumes:
      - dbdata:/var/lib/postgresql/data

volumes:
  dbdata:
```

Start and rebuild:

```powershell
docker compose -f docker-compose.dev.yml up -d --build
```

Stop:

```powershell
docker compose -f docker-compose.dev.yml down
```

## Never `dotnet run` the app

!!! danger
    Do not start the application with `dotnet run`. Always use Docker Compose.

Running outside the container diverges from the real environment: different paths, missing dependencies, different networking, and configuration that only exists in compose. Bugs found this way are often not reproducible.

This rule is about the *application*. Test projects are executables and are run with `dotnet run` as described in [Build Pipeline](../ci/build.md).

## Configuration

Pass settings as environment variables using the `Section__Key` convention. Compose is the single place where dev defaults for the container are defined. See [Options Pattern](../config/options-pattern.md) for how they bind.

## Frontend

If the solution has a frontend, keep it in its own project folder with its own package manager (pnpm or npm), and commit the lockfile.

```
src/YourApp.UI/
  package.json
  pnpm-lock.yaml
```

```powershell
pnpm install
pnpm dev
```

Pick one package manager per repository and do not mix lockfiles.

## Hot reload

Where possible, use volume mounts so changes are picked up without a full image rebuild.

| What | Approach |
|------|----------|
| Frontend | Mount source and run the dev server (Vite HMR) in a container |
| Config files | Mount as a volume, restart the container |
| .NET code | Rebuild the image. `dotnet watch` inside a container is optional and only if it is reliable for your stack |

!!! tip
    Keep Dockerfile layers ordered so restore is cached (copy project files and `Directory.Packages.props` first, then source). Rebuilds then stay fast.

## Checklist

- [x] `docker-compose.dev.yml` runs the app and its dependencies
- [x] App is never started with `dotnet run`
- [x] Frontend uses a single package manager with a committed lockfile
- [x] Volume mounts for fast iteration where possible
