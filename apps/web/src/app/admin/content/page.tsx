'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getClientApiBaseUrl, withApiBase } from '@/lib/api-base-url';
import { ApiRequestError, fetchJsonWithTimeout } from '@/lib/fetch-json';

type ContentBlock = {
  key: string;
  value: string | null;
  type: 'text' | 'image' | 'html';
  description: string | null;
};

type PresetBlock = {
  key: string;
  type: ContentBlock['type'];
  description: string;
  defaultValue?: string;
};

type PagePreset = {
  route: string;
  title: string;
  note: string;
  keyPrefix: string;
  blocks: PresetBlock[];
};

const PAGE_PRESETS: PagePreset[] = [
  {
    route: '/',
    title: 'Главная',
    note: 'Hero, CTA и ключевые подписи главной страницы',
    keyPrefix: 'home_',
    blocks: [
      { key: 'home_hero_title', type: 'text', description: 'Заголовок hero на главной', defaultValue: 'Все запчасти и автосервис в одном месте' },
      { key: 'home_hero_subtitle', type: 'text', description: 'Подзаголовок hero на главной', defaultValue: 'Оригинальные запчасти и профессиональный ремонт легковых и грузовых автомобилей в Красноярске' },
      { key: 'home_hero_cta_parts_label', type: 'text', description: 'Текст кнопки CTA "Запчасти"', defaultValue: 'Подобрать запчасти' },
      { key: 'home_hero_cta_service_label', type: 'text', description: 'Текст кнопки CTA "Сервис"', defaultValue: 'Записаться на сервис' },
      { key: 'home_order_parts_title', type: 'text', description: 'Заголовок блока "Не нашли нужную запчасть?"', defaultValue: 'Не нашли нужную запчасть?' },
      { key: 'home_order_parts_subtitle', type: 'text', description: 'Подзаголовок блока "Запчасти под заказ"', defaultValue: 'Закажите обратный звонок — мы подберём и привезём' },
      { key: 'home_order_parts_cta_label', type: 'text', description: 'Текст CTA в блоке "Запчасти под заказ"', defaultValue: 'Оставьте заявку' },
      { key: 'home_contacts_address', type: 'text', description: 'Адрес в контактном блоке главной', defaultValue: 'г. Красноярск, пр. Металлургов, 2В' },
      { key: 'home_contacts_schedule', type: 'text', description: 'График в контактном блоке главной', defaultValue: 'Пн–Пт 9:00–19:00, Сб 10:00–17:00, Вс выходной' },
      { key: 'home_contacts_phone', type: 'text', description: 'Телефон в контактном блоке главной', defaultValue: '+7 (391) 258-95-00' },
    ],
  },
  {
    route: '/contacts',
    title: 'Контакты',
    note: 'Телефоны, email, адрес, график, реквизиты',
    keyPrefix: 'contacts_',
    blocks: [
      { key: 'contacts_address', type: 'text', description: 'Адрес в блоке "Как нас найти"', defaultValue: '660000, г. Красноярск, пр. Металлургов, 2В' },
      { key: 'contacts_schedule_weekdays', type: 'text', description: 'График Пн–Пт', defaultValue: '09:00 – 19:00' },
      { key: 'contacts_schedule_saturday', type: 'text', description: 'График Сб', defaultValue: '10:00 – 17:00' },
      { key: 'contacts_schedule_sunday', type: 'text', description: 'График Вс', defaultValue: 'Выходной' },
      { key: 'contacts_phone_parts', type: 'text', description: 'Телефон отдела запчастей', defaultValue: '+7 (391) 258-95-00' },
      { key: 'contacts_phone_service', type: 'text', description: 'Телефон автосервиса', defaultValue: '+7 (391) 258-95-01' },
      { key: 'contacts_phone_main', type: 'text', description: 'Телефон единой линии', defaultValue: '+7 (391) 258-95-00' },
      { key: 'contacts_email_info', type: 'text', description: 'Email по общим вопросам', defaultValue: 'info@vsezapchasti.ru' },
      { key: 'contacts_email_service', type: 'text', description: 'Email сервиса', defaultValue: 'service@vsezapchasti.ru' },
      { key: 'contacts_email_privacy', type: 'text', description: 'Email по персональным данным', defaultValue: 'privacy@vsezapchasti.ru' },
      { key: 'contacts_legal_name', type: 'text', description: 'Юр. наименование', defaultValue: 'ИП Иванов Иван Иванович' },
      { key: 'contacts_inn', type: 'text', description: 'ИНН', defaultValue: '246500123456' },
      { key: 'contacts_ogrnip', type: 'text', description: 'ОГРНИП', defaultValue: '321246800123456' },
      { key: 'contacts_legal_address', type: 'text', description: 'Юридический адрес', defaultValue: '660000, г. Красноярск, ул. Ленина, 1' },
      { key: 'contacts_bank_account', type: 'text', description: 'Расчётный счёт', defaultValue: '40802810900001234567' },
      { key: 'contacts_bank_name', type: 'text', description: 'Банк', defaultValue: 'ПАО Сбербанк г. Красноярск' },
      { key: 'contacts_bank_bik', type: 'text', description: 'БИК', defaultValue: '040407123' },
      { key: 'contacts_map_yandex_url', type: 'text', description: 'Ссылка на Яндекс Карты', defaultValue: 'https://yandex.ru/maps/?text=%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D1%8F%D1%80%D1%81%D0%BA%2C%20%D0%BF%D1%80.%20%D0%9C%D0%B5%D1%82%D0%B0%D0%BB%D0%BB%D1%83%D1%80%D0%B3%D0%BE%D0%B2%2C%202%D0%92' },
      { key: 'contacts_map_2gis_url', type: 'text', description: 'Ссылка на 2GIS', defaultValue: 'https://2gis.ru/krasnoyarsk/search/%D0%BF%D1%80.%20%D0%9C%D0%B5%D1%82%D0%B0%D0%BB%D0%BB%D1%83%D1%80%D0%B3%D0%BE%D0%B2%202%D0%92' },
    ],
  },
  {
    route: '/about',
    title: 'О компании',
    note: 'Заголовок, подзаголовок и основные блоки страницы о компании',
    keyPrefix: 'about_',
    blocks: [
      { key: 'about_hero_title', type: 'text', description: 'Заголовок hero на странице о компании', defaultValue: 'О компании «Все запчасти»' },
      { key: 'about_hero_subtitle', type: 'text', description: 'Подзаголовок hero на странице о компании', defaultValue: 'Поставляем запчасти и обслуживаем коммерческий транспорт в Красноярске' },
      { key: 'about_story_title', type: 'text', description: 'Заголовок блока "Наша история"', defaultValue: 'Наша история' },
      { key: 'about_story_text', type: 'html', description: 'Текст блока "Наша история" (HTML)', defaultValue: '' },
      { key: 'about_values_title', type: 'text', description: 'Заголовок блока "Наши принципы"', defaultValue: 'Наши принципы' },
      { key: 'about_values_text', type: 'html', description: 'Текст блока "Наши принципы" (HTML)', defaultValue: '' },
    ],
  },
  {
    route: '/privacy',
    title: 'Политика конфиденциальности',
    note: 'Дата обновления и HTML-текст документа',
    keyPrefix: 'privacy_',
    blocks: [
      { key: 'privacy_last_updated', type: 'text', description: 'Дата обновления (подзаголовок)', defaultValue: '5 марта 2026 г.' },
      { key: 'privacy_content_html', type: 'html', description: 'Основной HTML-контент политики', defaultValue: '' },
    ],
  },
  {
    route: '/offer',
    title: 'Публичная оферта',
    note: 'Дата обновления и HTML-текст документа',
    keyPrefix: 'offer_',
    blocks: [
      { key: 'offer_last_updated', type: 'text', description: 'Дата обновления (подзаголовок)', defaultValue: '5 марта 2026 г.' },
      { key: 'offer_content_html', type: 'html', description: 'Основной HTML-контент оферты', defaultValue: '' },
    ],
  },
  {
    route: '/service',
    title: 'Автосервис',
    note: 'Hero, подписи формы и success-тексты страницы сервиса',
    keyPrefix: 'service_',
    blocks: [
      { key: 'service_hero_title', type: 'text', description: 'Заголовок hero на странице сервиса', defaultValue: 'Автосервис в Красноярске' },
      { key: 'service_hero_subtitle', type: 'text', description: 'Подзаголовок hero на странице сервиса', defaultValue: 'Профессиональный ремонт и обслуживание автомобилей' },
      { key: 'service_form_title', type: 'text', description: 'Заголовок формы сервиса', defaultValue: 'Заявка на обслуживание' },
      { key: 'service_form_subtitle', type: 'text', description: 'Подзаголовок формы сервиса', defaultValue: 'Заполните форму — менеджер свяжется с вами для подтверждения' },
      { key: 'service_success_title', type: 'text', description: 'Заголовок после успешной отправки формы', defaultValue: 'Заявка отправлена!' },
      { key: 'service_success_text', type: 'text', description: 'Текст после успешной отправки формы', defaultValue: 'Менеджер свяжется с вами в рабочее время для подтверждения записи.' },
    ],
  },
  {
    route: '/parts',
    title: 'Каталог запчастей',
    note: 'Hero и подписи поиска/результатов в каталоге',
    keyPrefix: 'parts_',
    blocks: [
      { key: 'parts_hero_title', type: 'text', description: 'Заголовок страницы каталога', defaultValue: 'Подбор запчастей' },
      { key: 'parts_hero_subtitle', type: 'text', description: 'Подзаголовок страницы каталога', defaultValue: 'Ищите по артикулу/OEM или названию. Если не уверены — оставьте VIN-заявку, менеджер подберёт совместимость.' },
      { key: 'parts_search_label', type: 'text', description: 'Подпись поля поиска', defaultValue: 'Поиск по артикулу или OEM' },
      { key: 'parts_search_placeholder', type: 'text', description: 'Placeholder поля поиска', defaultValue: 'Например: 06A905161B' },
      { key: 'parts_short_query_message', type: 'text', description: 'Текст для слишком короткого запроса', defaultValue: 'Для поиска укажите минимум 2 символа (например, артикул, OEM или часть названия).' },
    ],
  },
  {
    route: '/parts/vin',
    title: 'VIN-подбор',
    note: 'Hero и тексты формы VIN-подбора',
    keyPrefix: 'vin_',
    blocks: [
      { key: 'vin_hero_title', type: 'text', description: 'Заголовок hero на VIN-странице', defaultValue: 'VIN-заявка' },
      { key: 'vin_hero_subtitle', type: 'text', description: 'Подзаголовок hero на VIN-странице', defaultValue: 'Не знаете точный артикул? Оставьте VIN — мы подберём запчасти по вашему автомобилю' },
      { key: 'vin_form_title', type: 'text', description: 'Заголовок формы VIN-заявки', defaultValue: 'VIN-номер *' },
      { key: 'vin_form_submit_label', type: 'text', description: 'Текст кнопки отправки VIN-заявки', defaultValue: 'Отправить заявку' },
      { key: 'vin_success_title', type: 'text', description: 'Заголовок после успешной отправки VIN-заявки', defaultValue: 'Заявка отправлена!' },
      { key: 'vin_success_text', type: 'text', description: 'Текст после успешной отправки VIN-заявки', defaultValue: 'Менеджер свяжется с вами в рабочее время для уточнения деталей.' },
    ],
  },
  {
    route: '/cart',
    title: 'Корзина',
    note: 'Заголовки и подписи страницы корзины/оформления заказа',
    keyPrefix: 'cart_',
    blocks: [
      { key: 'cart_page_title', type: 'text', description: 'Заголовок страницы корзины', defaultValue: 'Корзина' },
      { key: 'cart_empty_text', type: 'text', description: 'Текст пустой корзины', defaultValue: 'Ваша корзина пуста' },
      { key: 'cart_go_to_catalog_label', type: 'text', description: 'Текст кнопки перехода в каталог', defaultValue: 'Перейти в каталог' },
      { key: 'cart_items_title', type: 'text', description: 'Заголовок блока списка товаров', defaultValue: 'Товары' },
      { key: 'cart_checkout_title', type: 'text', description: 'Заголовок блока оформления заказа', defaultValue: 'Оформление заказа' },
    ],
  },
  {
    route: '/favorites',
    title: 'Избранное',
    note: 'Подписи страницы избранного и кнопок действий',
    keyPrefix: 'favorites_',
    blocks: [
      { key: 'favorites_page_title', type: 'text', description: 'Заголовок страницы избранного', defaultValue: 'Избранное' },
      { key: 'favorites_clear_label', type: 'text', description: 'Кнопка очистки списка', defaultValue: 'Очистить список' },
      { key: 'favorites_empty_text', type: 'text', description: 'Текст пустого избранного', defaultValue: 'Список избранного пока пуст.' },
      { key: 'favorites_open_catalog_label', type: 'text', description: 'Кнопка перехода в каталог', defaultValue: 'Открыть каталог' },
      { key: 'favorites_open_product_label', type: 'text', description: 'Кнопка перехода к товару', defaultValue: 'К товару' },
      { key: 'favorites_add_to_cart_label', type: 'text', description: 'Кнопка добавления в корзину', defaultValue: 'В корзину' },
    ],
  },
  {
    route: '/account/orders',
    title: 'Мои заказы',
    note: 'Заголовки и подписи страницы истории заказов',
    keyPrefix: 'orders_',
    blocks: [
      { key: 'orders_page_title', type: 'text', description: 'Заголовок страницы истории заказов', defaultValue: 'Мои заказы' },
      { key: 'orders_page_subtitle', type: 'text', description: 'Подзаголовок страницы истории заказов', defaultValue: 'Введите телефон, который указывали при оформлении заказа, чтобы посмотреть историю и статусы.' },
      { key: 'orders_show_button_label', type: 'text', description: 'Текст кнопки поиска заказов', defaultValue: 'Показать заказы' },
      { key: 'orders_empty_text', type: 'text', description: 'Текст, когда заказы не найдены', defaultValue: 'По этому номеру пока нет заказов.' },
    ],
  },
  {
    route: '/shared',
    title: 'Общие блоки (Header/Footer)',
    note: 'Общие подписи навигации и футера для публичных страниц',
    keyPrefix: 'site_',
    blocks: [
      { key: 'site_brand_name', type: 'text', description: 'Название бренда в хедере', defaultValue: 'Все запчасти' },
      { key: 'site_nav_parts_label', type: 'text', description: 'Пункт меню "Запчасти"', defaultValue: 'Запчасти' },
      { key: 'site_nav_service_label', type: 'text', description: 'Пункт меню "Автосервис"', defaultValue: 'Автосервис' },
      { key: 'site_nav_contacts_label', type: 'text', description: 'Пункт меню "Контакты"', defaultValue: 'Контакты' },
      { key: 'site_nav_about_label', type: 'text', description: 'Пункт меню "О компании"', defaultValue: 'О компании' },
      { key: 'site_nav_favorites_label', type: 'text', description: 'Пункт меню "Избранное"', defaultValue: 'Избранное' },
      { key: 'site_nav_cart_label', type: 'text', description: 'Пункт меню "Корзина"', defaultValue: 'Корзина' },
      { key: 'site_nav_orders_label', type: 'text', description: 'Пункт меню "Мои заказы"', defaultValue: 'Мои заказы' },
      { key: 'site_footer_text', type: 'text', description: 'Текст футера', defaultValue: 'Все запчасти · Красноярск · NO CDN' },
      { key: 'site_legal_privacy_label', type: 'text', description: 'Подпись ссылки на политику', defaultValue: 'Политика конфиденциальности' },
      { key: 'site_legal_offer_label', type: 'text', description: 'Подпись ссылки на оферту', defaultValue: 'Публичная оферта' },
    ],
  },
];

export default function ContentEditorPage() {
  const router = useRouter();
  const [content, setContent] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingPresetRoute, setCreatingPresetRoute] = useState('');
  const [creatingAllPresets, setCreatingAllPresets] = useState(false);
  const [deletingKey, setDeletingKey] = useState('');
  const [pendingDeleteKey, setPendingDeleteKey] = useState('');
  const [keyFilter, setKeyFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingValue, setEditingValue] = useState<{[key: string]: string}>({});
  const [newBlock, setNewBlock] = useState({
    key: '',
    value: '',
    type: 'text' as ContentBlock['type'],
    description: '',
  });

  const redirectToLogin = useCallback(() => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  }, [router]);

  const getTokenOrRedirect = useCallback((): string | null => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/admin/login');
      return null;
    }
    return token;
  }, [router]);

  const isAuthError = useCallback((error: unknown): boolean => {
    if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
      redirectToLogin();
      return true;
    }
    return false;
  }, [redirectToLogin]);

  const formatError = (error: unknown, fallback: string): string => {
    if (error instanceof ApiRequestError) {
      return error.traceId ? `${error.message}. Код: ${error.traceId}` : error.message;
    }
    return fallback;
  };

  const fetchContent = useCallback(async () => {
    try {
      const token = getTokenOrRedirect();
      if (!token) return;
      
      const apiBaseUrl = getClientApiBaseUrl();
      const data = await fetchJsonWithTimeout<ContentBlock[]>(
        withApiBase(apiBaseUrl, '/api/admin/content'),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        12000
      );
      setContent(data);
      
      const initialValues: {[key: string]: string} = {};
      data.forEach((block: ContentBlock) => {
        initialValues[block.key] = block.value || '';
      });
      setEditingValue(initialValues);
    } catch (err) {
      if (isAuthError(err)) return;
      setError(formatError(err, 'Ошибка загрузки контента'));
    } finally {
      setLoading(false);
    }
  }, [getTokenOrRedirect, isAuthError]);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  async function handleSave(key: string) {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = getTokenOrRedirect();
      if (!token) return;
      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout<ContentBlock>(
        withApiBase(apiBaseUrl, `/api/admin/content/${encodeURIComponent(key)}`),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ value: editingValue[key] }),
        },
        12000
      );
      
      setContent((prev) =>
        prev.map((block) =>
          block.key === key
            ? { ...block, value: editingValue[key] || null }
            : block
        )
      );
      setSuccess(`Блок "${key}" сохранён`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      if (isAuthError(err)) return;
      setError(formatError(err, `Ошибка сохранения блока "${key}"`));
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(key: string, file: File) {
    setUploading(true);
    setError('');

    try {
      const token = getTokenOrRedirect();
      if (!token) return;
      const formData = new FormData();
      formData.append('file', file);

      const apiBaseUrl = getClientApiBaseUrl();
      const data = await fetchJsonWithTimeout<{ url: string }>(
        withApiBase(apiBaseUrl, '/api/admin/upload'),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        },
        12000
      );
      setEditingValue(prev => ({...prev, [key]: data.url}));
      
      setSuccess(`Изображение загружено`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      if (isAuthError(err)) return;
      setError(formatError(err, 'Ошибка загрузки изображения'));
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateBlock() {
    if (!newBlock.key.trim()) {
      setError('Ключ блока обязателен');
      return;
    }

    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const token = getTokenOrRedirect();
      if (!token) return;
      const apiBaseUrl = getClientApiBaseUrl();
      const createdBlock = await fetchJsonWithTimeout<ContentBlock>(
        withApiBase(apiBaseUrl, '/api/admin/content'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            key: newBlock.key.trim(),
            value: newBlock.value || null,
            type: newBlock.type,
            description: newBlock.description || null,
          }),
        },
        12000
      );

      setContent(prev => [...prev, createdBlock].sort((a, b) => a.key.localeCompare(b.key)));
      setEditingValue(prev => ({ ...prev, [createdBlock.key]: createdBlock.value || '' }));
      setNewBlock({ key: '', value: '', type: 'text', description: '' });
      setSuccess(`Блок "${createdBlock.key}" создан`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (createError) {
      if (isAuthError(createError)) return;
      setError(formatError(createError, 'Ошибка создания блока'));
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteBlock(key: string) {
    setDeletingKey(key);
    setError('');
    setSuccess('');

    try {
      const token = getTokenOrRedirect();
      if (!token) return;
      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout<unknown>(
        withApiBase(apiBaseUrl, `/api/admin/content/${encodeURIComponent(key)}`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        12000
      );

      setContent(prev => prev.filter(block => block.key !== key));
      setEditingValue(prev => {
        const next = {...prev};
        delete next[key];
        return next;
      });
      if (pendingDeleteKey === key) {
        setPendingDeleteKey('');
      }
      setSuccess(`Блок "${key}" удалён`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (deleteError) {
      if (isAuthError(deleteError)) return;
      setError(formatError(deleteError, `Ошибка удаления блока "${key}"`));
      setPendingDeleteKey('');
    } finally {
      setDeletingKey('');
    }
  }

  async function handleCreatePresetBlocks(preset: PagePreset) {
    const existingKeys = new Set(content.map((block) => block.key));
    const missing = preset.blocks.filter((block) => !existingKeys.has(block.key));
    if (missing.length === 0) {
      setSuccess(`Для страницы "${preset.route}" все ключи уже созданы`);
      setTimeout(() => setSuccess(''), 3000);
      return;
    }

    setCreatingPresetRoute(preset.route);
    setError('');
    setSuccess('');

    try {
      const token = getTokenOrRedirect();
      if (!token) return;

      const apiBaseUrl = getClientApiBaseUrl();
      const created: ContentBlock[] = [];
      for (const block of missing) {
        const createdBlock = await fetchJsonWithTimeout<ContentBlock>(
          withApiBase(apiBaseUrl, '/api/admin/content'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              key: block.key,
              value: block.defaultValue ?? null,
              type: block.type,
              description: block.description,
            }),
          },
          12000
        );
        created.push(createdBlock);
      }

      if (created.length > 0) {
        setContent((prev) => [...prev, ...created].sort((a, b) => a.key.localeCompare(b.key)));
        setEditingValue((prev) => {
          const next = { ...prev };
          for (const block of created) {
            next[block.key] = block.value || '';
          }
          return next;
        });
      }

      setSuccess(`Создано ключей для "${preset.route}": ${created.length}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (createError) {
      if (isAuthError(createError)) return;
      setError(formatError(createError, 'Ошибка создания ключей страницы'));
    } finally {
      setCreatingPresetRoute('');
    }
  }

  async function handleCreateAllPresetBlocks() {
    setCreatingAllPresets(true);
    setError('');
    setSuccess('');

    try {
      let createdTotal = 0;
      for (const preset of PAGE_PRESETS) {
        const existingKeys = new Set(content.map((block) => block.key));
        const missing = preset.blocks.filter((block) => !existingKeys.has(block.key));
        if (missing.length === 0) continue;

        setCreatingPresetRoute(preset.route);
        const token = getTokenOrRedirect();
        if (!token) return;

        const apiBaseUrl = getClientApiBaseUrl();
        const created: ContentBlock[] = [];
        for (const block of missing) {
          const createdBlock = await fetchJsonWithTimeout<ContentBlock>(
            withApiBase(apiBaseUrl, '/api/admin/content'),
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                key: block.key,
                value: block.defaultValue ?? null,
                type: block.type,
                description: block.description,
              }),
            },
            12000
          );
          created.push(createdBlock);
        }

        if (created.length > 0) {
          createdTotal += created.length;
          setContent((prev) => [...prev, ...created].sort((a, b) => a.key.localeCompare(b.key)));
          setEditingValue((prev) => {
            const next = { ...prev };
            for (const block of created) {
              next[block.key] = block.value || '';
            }
            return next;
          });
        }
      }

      setSuccess(createdTotal > 0 ? `Создано ключей: ${createdTotal}` : 'Все ключи уже созданы');
      setTimeout(() => setSuccess(''), 3000);
    } catch (createError) {
      if (isAuthError(createError)) return;
      setError(formatError(createError, 'Ошибка создания ключей страницы'));
    } finally {
      setCreatingPresetRoute('');
      setCreatingAllPresets(false);
    }
  }

  async function handleSaveAllChanged() {
    const dirtyKeys = content
      .filter((block) => (editingValue[block.key] || '') !== (block.value || ''))
      .map((block) => block.key);

    if (dirtyKeys.length === 0) {
      setSuccess('Нет несохранённых изменений');
      setTimeout(() => setSuccess(''), 3000);
      return;
    }

    setSavingAll(true);
    setError('');
    setSuccess('');

    try {
      const token = getTokenOrRedirect();
      if (!token) return;

      const apiBaseUrl = getClientApiBaseUrl();
      for (const key of dirtyKeys) {
        await fetchJsonWithTimeout<ContentBlock>(
          withApiBase(apiBaseUrl, `/api/admin/content/${encodeURIComponent(key)}`),
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ value: editingValue[key] }),
          },
          12000
        );
      }

      setContent((prev) =>
        prev.map((block) => {
          if (!dirtyKeys.includes(block.key)) return block;
          return { ...block, value: editingValue[block.key] || null };
        })
      );
      setSuccess(`Сохранено блоков: ${dirtyKeys.length}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (saveError) {
      if (isAuthError(saveError)) return;
      setError(formatError(saveError, 'Ошибка массового сохранения'));
    } finally {
      setSavingAll(false);
    }
  }

  const dirtyCount = content.filter((block) => (editingValue[block.key] || '') !== (block.value || '')).length;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyCount === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  const filteredContent = content.filter((block) => {
    const filter = keyFilter.trim().toLowerCase();
    if (!filter) return true;
    return block.key.toLowerCase().includes(filter);
  });
  const existingKeys = new Set(content.map((block) => block.key));
  const totalPresetKeys = PAGE_PRESETS.reduce((sum, preset) => sum + preset.blocks.length, 0);
  const totalMissingPresetKeys = PAGE_PRESETS.reduce(
    (sum, preset) => sum + preset.blocks.filter((block) => !existingKeys.has(block.key)).length,
    0
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1F3B73] mb-6">Редактор контента сайта</h1>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSaveAllChanged}
          disabled={savingAll || dirtyCount === 0}
          className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F] disabled:opacity-50"
        >
          {savingAll ? 'Сохранение...' : `Сохранить все изменения (${dirtyCount})`}
        </button>
        <span className="text-xs text-neutral-500">Несохранённых блоков: {dirtyCount}</span>
      </div>
      
      {error && (
        <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-6 rounded-2xl bg-green-50 p-4 text-sm text-green-600 border border-green-200">
          {success}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-[#1F3B73]">Страницы сайта</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Создайте готовые ключи для редактирования публичных страниц.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-neutral-500">
            Всего пресет-ключей: {totalPresetKeys} · отсутствует: {totalMissingPresetKeys}
          </div>
          <button
            type="button"
            onClick={handleCreateAllPresetBlocks}
            disabled={creatingAllPresets || totalMissingPresetKeys === 0}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {creatingAllPresets ? 'Создание всех ключей...' : 'Создать недостающие ключи для всех страниц'}
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PAGE_PRESETS.map((preset) => {
            const missingCount = preset.blocks.filter((block) => !existingKeys.has(block.key)).length;
            return (
              <div key={preset.route} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-sm font-semibold text-[#1F3B73]">{preset.title}</div>
                <div className="mt-1 text-xs text-neutral-500">{preset.route}</div>
                <div className="mt-2 text-xs text-neutral-600">{preset.note}</div>
                <div className="mt-2 text-xs text-neutral-500">
                  Ключей: {preset.blocks.length} · отсутствует: {missingCount}
                </div>
                <button
                  type="button"
                  onClick={() => setKeyFilter(preset.keyPrefix)}
                  className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  Открыть ключи страницы
                </button>
                <Link
                  href={preset.route === '/shared' ? '/' : preset.route}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-center text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  Открыть страницу
                </Link>
                <button
                  type="button"
                  onClick={() => handleCreatePresetBlocks(preset)}
                  disabled={creatingPresetRoute === preset.route || missingCount === 0}
                  className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  {missingCount === 0
                    ? 'Все ключи созданы'
                    : creatingPresetRoute === preset.route
                      ? 'Создание...'
                      : 'Создать недостающие ключи'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-[#1F3B73]">Новый блок</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Ключ *</label>
            <input
              type="text"
              value={newBlock.key}
              onChange={(e) => setNewBlock({...newBlock, key: e.target.value})}
              placeholder="например: hero_title"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Тип</label>
            <select
              value={newBlock.type}
              onChange={(e) => setNewBlock({...newBlock, type: e.target.value as ContentBlock['type']})}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            >
              <option value="text">Текст</option>
              <option value="image">Изображение</option>
              <option value="html">HTML</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Описание</label>
            <input
              type="text"
              value={newBlock.description}
              onChange={(e) => setNewBlock({...newBlock, description: e.target.value})}
              placeholder="Описание для админки"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Значение</label>
            <textarea
              rows={4}
              value={newBlock.value}
              onChange={(e) => setNewBlock({...newBlock, value: e.target.value})}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleCreateBlock}
            disabled={creating}
            className="rounded-2xl bg-[#1F3B73] px-6 py-2 text-sm font-medium text-white hover:bg-[#14294F] disabled:opacity-50"
          >
            {creating ? 'Создание...' : 'Создать блок'}
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-neutral-700">Фильтр ключей</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={keyFilter}
            onChange={(event) => setKeyFilter(event.target.value)}
            placeholder="Например: contacts_"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setKeyFilter('')}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Сбросить
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {filteredContent.map((block) => (
          <div key={block.key} className="border border-neutral-200 rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-[#1F3B73]">{block.key}</h3>
                {block.description && (
                  <p className="text-sm text-neutral-500 mt-1">{block.description}</p>
                )}
                <span className="inline-block mt-2 text-xs px-2 py-1 bg-neutral-100 rounded-full">
                  {block.type === 'text' ? 'Текст' : block.type === 'image' ? 'Изображение' : 'HTML'}
                </span>
              </div>
            </div>

            {block.type === 'text' && (
              <div>
                <textarea
                  value={editingValue[block.key] || ''}
                  onChange={(e) => setEditingValue({...editingValue, [block.key]: e.target.value})}
                  rows={5}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
                />
              </div>
            )}

            {block.type === 'image' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    URL изображения
                  </label>
                  <input
                    type="text"
                    value={editingValue[block.key] || ''}
                    onChange={(e) => setEditingValue({...editingValue, [block.key]: e.target.value})}
                    placeholder="URL изображения"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Или загрузите файл
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(block.key, file);
                      }}
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-2xl file:border-0 file:bg-[#1F3B73] file:text-white hover:file:bg-[#14294F] sm:flex-1"
                    />
                    {uploading && (
                      <div className="flex items-center text-sm text-neutral-500">
                        Загрузка...
                      </div>
                    )}
                  </div>
                </div>

                {editingValue[block.key] && (
                  <div className="mt-4">
                    <p className="text-sm text-neutral-500 mb-2">Предпросмотр:</p>
                    <div className="relative h-40 w-40 border border-neutral-200 rounded-2xl overflow-hidden">
                      <Image 
                        src={editingValue[block.key]} 
                        alt={block.key}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {block.type === 'html' && (
              <div>
                <textarea
                  value={editingValue[block.key] || ''}
                  onChange={(e) => setEditingValue({...editingValue, [block.key]: e.target.value})}
                  rows={8}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm focus:border-[#1F3B73] focus:outline-none"
                />
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {pendingDeleteKey === block.key ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => void handleDeleteBlock(block.key)}
                    disabled={saving || uploading || deletingKey === block.key}
                    className="w-full rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 sm:w-auto"
                  >
                    {deletingKey === block.key ? 'Удаление...' : 'Подтвердить'}
                  </button>
                  <button
                    onClick={() => setPendingDeleteKey('')}
                    disabled={deletingKey === block.key}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 sm:w-auto"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPendingDeleteKey(block.key)}
                  disabled={saving || uploading}
                  className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 sm:w-auto"
                >
                  Удалить
                </button>
              )}
              <button
                onClick={() => handleSave(block.key)}
                disabled={saving || uploading}
                className="w-full rounded-2xl bg-[#FF7A00] px-6 py-2 text-sm font-medium text-white hover:bg-[#e66e00] disabled:opacity-50 transition sm:w-auto"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredContent.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200">
          <p className="text-neutral-500">По текущему фильтру блоков нет</p>
          <p className="text-sm text-neutral-400 mt-2">
            Измените фильтр ключей или создайте недостающие ключи для страницы
          </p>
        </div>
      )}
    </div>
  );
}
