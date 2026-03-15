# АвтоПлатформа

Production-ready платформа для каталога автозапчастей и автосервиса.
Собрана с нуля за 3–4 дня с помощью AI-инструментов (Codex, Claude, ChatGPT).

## Что умеет

- Каталог запчастей с поиском по SKU / OEM / названию
- VIN-подбор для ручного подбора менеджером
- Запись на автосервис
- Корзина и оформление заказа без регистрации
- История заказов по номеру телефона
- Полная админка: импорт каталога CSV/XLSX, управление заявками, центр уведомлений
- Интеграции: 1С/ERP, уведомления email/SMS
- Compliance 152-ФЗ

## Стек

- Frontend: Next.js, TypeScript
- Backend: FastAPI, Python, SQLAlchemy, Alembic
- База данных: PostgreSQL, Redis
- Инфраструктура: Docker, Docker Compose, REST API

## Запуск

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

## Инструменты разработки

Codex (VS Code), Claude, ChatGPT — AI-assisted development без написания кода вручную.
Проект построен на основе RU Stack Lock v1.7 — собственного инженерного baseline для РФ-проектов.
