# Все запчасти

Fullstack-платформа для бизнеса автозапчастей и автосервиса: каталог, карточки товаров, корзина, оформление заказов, VIN-заявки, запись на сервис и административная панель.

## Коротко

Это мой production-style кейс, собранный с нуля с активным использованием Codex и ChatGPT как AI-инструментов разработки.
Моя задача была не просто получить код, а довести проект до рабочего состояния: поднять инфраструктуру, исправить проблемы окружения, восстановить runtime, выровнять verify-процесс, обновить брендинг и упаковать результат в демонстрационный кейс.

## Что есть в проекте

- публичный сайт на Next.js
- backend API на FastAPI
- PostgreSQL и Redis
- админка с авторизацией
- каталог товаров
- категории
- поиск по SKU / OEM / названию
- корзина и оформление заказа
- VIN-заявки
- запись на сервис
- импорт каталога из CSV/XLSX
- Docker-based запуск
- verify и operational scripts

## Стек

- Next.js
- TypeScript
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis
- Docker / Docker Compose

## Что я сделал

В рамках этого кейса я:

- поднял и восстановил локальный production-like baseline
- исправил проблемы с Python/uv окружением
- починил apps/api/Makefile
- починил scripts/verify-all.sh
- устранил рассинхрон env / secrets / postgres volume
- восстановил рабочую связку web + api + postgres + redis
- довёл проект до статуса ALL GREEN
- обновил шаблонный брендинг на «Все запчасти»
- добавил docs/OPERATIONS.md для запуска и проверки проекта

## Запуск

Старт:
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

Остановка:
docker compose --env-file .env.prod -f docker-compose.prod.yml down

Проверка:
bash scripts/verify-all.sh

## Статус проекта

На момент подготовки кейса:

- проект запускается локально
- verify проходит в зелёном статусе
- web и API работают
- admin authentication работает
- operational documentation оформлена
- каталог готов к наполнению через импорт

## Документация

- docs/OPERATIONS.md
- scripts/verify-all.sh
- scripts/import-products.sh
- scripts/import-product-images.sh

## Для работодателя

Этот проект показывает, что я умею:

- собирать fullstack-систему целиком
- использовать AI как рабочий инструмент разработки
- разбираться в инфраструктуре и runtime-проблемах
- доводить проект до воспроизводимого рабочего состояния
- оформлять и упаковывать результат как инженерный кейс

## Важно

В репозиторий не должны попадать реальные секреты, токены и production env-файлы.
