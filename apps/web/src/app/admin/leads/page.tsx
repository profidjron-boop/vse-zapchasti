type Lead = {
  id: number;
  uuid: string;
  type: string;
  status: string;
  name: string | null;
  phone: string;
  email: string | null;
  message: string | null;
  vin: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  product_id: number | null;
  product_sku: string | null;
  consent_given: boolean;
  created_at: string;
};

import Link from "next/link";

async function getLeads() {
  try {
    const res = await fetch("http://localhost:8000/api/admin/leads?limit=50", {
      cache: 'no-store'
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function AdminLeadsPage() {
  const leads = await getLeads();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1F3B73] mb-6">Заявки на запчасти</h1>

      {leads.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <p>Заявок пока нет</p>
          <p className="text-sm mt-2">Заявки появятся здесь после отправки форм на сайте</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Тип</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Статус</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Телефон</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Имя</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">VIN</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Дата</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {leads.map((lead: Lead) => (
                <tr key={lead.id} className="hover:bg-neutral-50">
                  <td className="py-3 px-4 text-sm">#{lead.id}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className="px-2 py-1 rounded-full bg-[#1F3B73]/10 text-[#1F3B73] text-xs">
                      {lead.type === 'vin' ? 'VIN' : 
                       lead.type === 'callback' ? 'Звонок' : 
                       lead.type === 'product' ? 'Товар' : 'Подбор'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{lead.phone}</td>
                  <td className="py-3 px-4 text-sm">{lead.name || '—'}</td>
                  <td className="py-3 px-4 text-sm font-mono">{lead.vin || '—'}</td>
                  <td className="py-3 px-4 text-sm">
                    {new Date(lead.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="text-[#1F3B73] hover:underline mr-3"
                    >
                      ✏️
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
