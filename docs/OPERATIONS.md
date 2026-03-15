# OPERATIONS

## Start
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

## Stop
docker compose --env-file .env.prod -f docker-compose.prod.yml down

## Status
docker compose --env-file .env.prod -f docker-compose.prod.yml ps

## Restart
docker compose --env-file .env.prod -f docker-compose.prod.yml down && docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

## Logs
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=200 -f

## Healthcheck
echo "--- WEB ---" && curl -I http://127.0.0.1:3000
echo
echo "--- API HEALTH ---" && curl -s http://127.0.0.1:8000/api/health
echo
echo "--- API READY ---" && curl -s http://127.0.0.1:8000/api/ready
