import type { Metadata } from "next";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import {
  fetchPublicContentMapServer,
  getPublicContentValue,
  getPublicSiteContent,
} from "@/lib/public-site-content";

export const metadata: Metadata = {
  title: "Политика конфиденциальности | АвтоПлатформа",
  description:
    "Шаблон политики обработки персональных данных для проекта каталога и сервиса (152-ФЗ).",
};

export default async function PrivacyPage() {
  const contentMap = await fetchPublicContentMapServer();
  const siteContent = getPublicSiteContent(contentMap);
  const lastUpdated = getPublicContentValue(
    contentMap,
    "privacy_last_updated",
    "5 марта 2026 г.",
  );
  const contentHtml = getPublicContentValue(
    contentMap,
    "privacy_content_html",
    "",
  );

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      <PublicHeader
        brandName={siteContent.brandName}
        labels={siteContent.labels}
      />

      <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:py-14">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)]">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              legal · privacy · 152-фз
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
              Политика конфиденциальности
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              Как мы собираем, храним и защищаем персональные данные по заявкам
              на запчасти, VIN-подбор и сервисные работы.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-medium text-white/80">
                Последнее обновление: {lastUpdated}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-medium text-white/80">
                Хранение и обработка данных в пределах РФ
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
              что важно знать
            </div>
            <div className="mt-4 space-y-3">
              {[
                "Мы собираем только данные, необходимые для обработки заявки и обратной связи.",
                "Факт согласия фиксируется вместе с версией политики и техническими метаданными.",
                "Персональные данные не используются для сторонних маркетинговых целей без отдельного основания.",
                "Запрос на удаление, уточнение или отзыв согласия можно направить на privacy@example-auto.ru.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] lg:p-8">
          {contentHtml ? (
            <div
              className="prose prose-neutral max-w-none text-neutral-700 prose-headings:font-bold prose-headings:text-[#10264B] prose-h2:text-2xl prose-p:leading-7 prose-li:leading-7"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          ) : (
            <div className="space-y-8 text-neutral-700">
              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">
                  1. Оператор персональных данных
                </h2>
                <p className="mt-3 leading-7">
                  Оператор: ООО «Пример Авто» (ИНН 0000000000, ОГРН
                  0000000000000), сайт: example-auto.ru. Политика действует в
                  соответствии с Федеральным законом от 27.07.2006 №152-ФЗ «О
                  персональных данных».
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">
                  2. Какие данные мы обрабатываем
                </h2>
                <ul className="mt-4 space-y-2 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 text-sm leading-7 text-neutral-700">
                  <li>Контактные данные: имя, телефон, email (если указан).</li>
                  <li>
                    Данные заявки: VIN, сообщение, тип обращения,
                    марка/модель/год, описание работ.
                  </li>
                  <li>
                    Служебные данные: IP-адрес, User-Agent, дата и время
                    отправки формы.
                  </li>
                  <li>
                    Данные согласия: факт согласия, версия текста согласия,
                    дата/время согласия.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">
                  3. Цели обработки
                </h2>
                <ul className="mt-4 space-y-2 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 text-sm leading-7 text-neutral-700">
                  <li>
                    Обработка заявок на подбор запчастей, VIN-подбор и обратный
                    звонок.
                  </li>
                  <li>Запись и сопровождение заявки на сервисные работы.</li>
                  <li>Связь с пользователем по статусу обращения.</li>
                  <li>
                    Ведение журнала согласий и событий для выполнения требований
                    152-ФЗ.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">
                  4. Правовые основания обработки
                </h2>
                <ul className="mt-4 space-y-2 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 text-sm leading-7 text-neutral-700">
                  <li>
                    Согласие субъекта персональных данных (ч. 1 ст. 6, ст. 9
                    152-ФЗ).
                  </li>
                  <li>
                    Необходимость обработки для заключения и исполнения договора
                    по обращению пользователя (п. 5 ч. 1 ст. 6 152-ФЗ).
                  </li>
                  <li>
                    Исполнение обязанностей оператора, установленных
                    законодательством РФ.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">
                  5. Хранение и безопасность
                </h2>
                <p className="mt-3 leading-7">
                  Персональные данные хранятся в информационных системах на
                  территории Российской Федерации. Срок хранения: до достижения
                  целей обработки, но не более 36 месяцев с даты последнего
                  обращения, если иной срок не предусмотрен законом или
                  договором. По истечении срока данные удаляются или
                  обезличиваются.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">
                  6. Передача третьим лицам
                </h2>
                <p className="mt-3 leading-7">
                  Передача персональных данных третьим лицам осуществляется
                  только при наличии законных оснований: исполнение требований
                  законодательства РФ, участие подрядчика в обработке по
                  поручению оператора, либо по отдельному согласию пользователя.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">
                  7. Права субъекта персональных данных
                </h2>
                <ul className="mt-4 space-y-2 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 text-sm leading-7 text-neutral-700">
                  <li>
                    Получать сведения об обработке своих персональных данных.
                  </li>
                  <li>
                    Требовать уточнения, блокирования или уничтожения данных.
                  </li>
                  <li>Отозвать согласие на обработку персональных данных.</li>
                  <li>
                    Обжаловать действия оператора в уполномоченный орган или в
                    суд.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">
                  8. Отзыв согласия и обращения
                </h2>
                <p className="mt-3 leading-7">
                  Для отзыва согласия или реализации прав субъекта направьте
                  запрос на privacy@example-auto.ru. В запросе укажите ФИО,
                  контактный номер и описание требования. Срок ответа — до 30
                  календарных дней.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-[#10264B]">
                  9. Контактная информация оператора
                </h2>
                <div className="mt-4 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 text-sm leading-7 text-neutral-700">
                  <p>Email: privacy@example-auto.ru</p>
                  <p>Тел.: +7 (900) 000-00-00</p>
                  <p>Адрес: г. Ваш город, ул. Примерная, 1</p>
                </div>
              </section>
            </div>
          )}
        </div>
      </section>

      <PublicFooter
        brandName={siteContent.brandName}
        footerText={siteContent.footerText}
        contactsLabel={siteContent.labels.contacts}
      />
    </main>
  );
}
