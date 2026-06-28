# Docker deployment guide

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- 512 MB RAM minimum (1 GB recommended)
- Port 3000 free (or set ATLAS_PORT)

## One-command deploy

```bash
docker compose up -d
```

## With Amadeus live fares

> The Amadeus self-service portal (and `test.api.amadeus.com`) is decommissioned
> on **2026-07-17**. After that, use **Enterprise** credentials with
> `AMADEUS_ENV=production`. Without working keys Atlas falls back to
> distance-estimated fares.

Create `.env` in the project root:

```
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
AMADEUS_ENV=production
```

Then:

```bash
docker compose up -d
```

## Custom port

```bash
ATLAS_PORT=8080 docker compose up -d
```

Or add `ATLAS_PORT=8080` to `.env`.

## Building the image manually

```bash
docker build -t atlas-travel-dashboard:latest .
docker run -p 3000:3000 --env-file .env atlas-travel-dashboard:latest
```

## Health check

```bash
curl http://localhost:3000/api/health
# {"status":"ok","service":"atlas","version":"0.1.0"}
```

The container's built-in healthcheck polls this endpoint every 30 seconds.

## Provider status

```bash
curl http://localhost:3000/api/status | python3 -m json.tool
```

Returns live/estimated/unavailable for each external provider.

## Updating

```bash
docker compose pull   # or rebuild: docker compose build --no-cache
docker compose up -d
```

## Persistence

The `atlas-cache` Docker volume persists the in-memory cache seed across
restarts. It is optional; the app functions without it.

## Reverse proxy (nginx example)

```nginx
server {
    listen 443 ssl;
    server_name atlas.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

The `X-Forwarded-For` header is used by the rate limiter to identify clients.

## Resource limits (optional)

Add to `docker-compose.yml` under the `atlas` service:

```yaml
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
```

## Logs

```bash
docker compose logs -f atlas
```
