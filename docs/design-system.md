# Design System — Все запчасти (Premium)

Цель: единый премиальный UI для публичных страниц и админки, повторно используемые компоненты, предсказуемые состояния.

## Runtime policy
- **NO CDN**: никаких Google Fonts / внешних скриптов / remote CSS.
- Шрифты, иконки, изображения — только **self-hosted** в репозитории/хранилище РФ.

## Visual principles (Premium)
- Глубина: фон + 2 поверхности (base + elevated), мягкие тени, аккуратный контраст.
- Типографика: 1–2 семейства шрифтов (self-hosted), ясная иерархия (H1/H2/body).
- Сетка: 12 колонок (desktop), 6 (tablet), 4 (mobile), max-width контейнера.
- Кнопки: 2 CTA (primary/secondary) на hero, без “мертвых” действий.
- Микро-анимации: subtle (hover/press), без “кислоты” и перегруза.
- A11y: фокус-стили, контраст, aria-label где нужно.

## States (обязательные)
- Loading: скелетоны/спиннеры.
- Empty: объясняющий текст + действие (если применимо).
- Error: человекочитаемо + (опционально) `Код: <trace_id>`.

## Components baseline (для реализации)
- Layout: Container, Section, Stack, Grid
- Navigation: TopNav, MobileNav, Breadcrumbs (по необходимости)
- Content: Card, Badge, Tabs, Accordion, Table
- Actions: Button, IconButton, Link
- Forms: Input, Select, Textarea, Checkbox, Radio, Switch
- Feedback: Toast, Alert, Modal/Drawer
- Data: Pagination, Filters, SearchBox

