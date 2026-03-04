# Project Context — vse-zapchasti

## Project
Название: Все запчасти  
Repo: /home/greka/vse-zapchasti  
Режим: Strict  
Stack: RU STACK LOCK (Next.js + FastAPI + Postgres)  
Runtime: NO CDN (все ассеты локально)  
Регион: РФ  
Город: Красноярск  

## Архитектура сайта
Выбран вариант A — «Две дороги»

Главная страница:
1. Hero
2. Две дороги
   - Подбор запчастей
   - Автосервис
3. Категории
4. Виды работ
5. Запчасти под заказ
6. Контакты

Основные страницы:

/ — главная  
/parts — подбор запчастей  
/service — автосервис  

## Web
Framework: Next.js (App Router)

Расположение:
apps/web

Текущие страницы:
apps/web/src/app/page.tsx
apps/web/src/app/parts/page.tsx

Verify команды:
pnpm web:lint  
pnpm web:typecheck  

## API
Framework: FastAPI

Расположение:
apps/api

Миграции:
Alembic

Verify команды:
make lint
make test
make migrate-check

## База данных

Postgres (docker compose)

Host port:
5433

DATABASE_URL пример:

postgresql+psycopg://vsez:vsez_dev_password_change_me@localhost:5433/vsez

Файл:
apps/api/.env.example

## Инфраструктура

docker-compose.yml
Postgres контейнер:
vsez_postgres

## Verify gates

Web:
pnpm web:lint
pnpm web:typecheck

API:
make lint
make test
make migrate-check

## Как начать новый чат

1. Перейти в репозиторий

cd ~/vse-zapchasti

2. Выполнить

docs/handoff.sh

3. Показать вывод ассистенту.

