import { ServiceRequest } from "./types";
import Link from "next/link";

async function getServiceRequests() {
  try {
    const res = await fetch("http://localhost:8000/api/admin/service-requests?limit=50", {
      cache: 'no-store'
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function AdminServiceRequestsPage() {
  const requests = await getServiceRequests();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1F3B73] mb-6">Заявки на сервис</h1>

      {requests.length === 0 ? (
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
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Тип авто</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Услуга</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Статус</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Телефон</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Имя</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Авто</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Дата</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {requests.map((req: ServiceRequest) => (
                <tr key={req.id} className="hover:bg-neutral-50">
                  <td className="py-3 px-4 text-sm">#{req.id}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      req.vehicle_type === 'truck' 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {req.vehicle_type === 'truck' ? 'Грузовой' : 'Легковой'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{req.service_type}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{req.phone}</td>
                  <td className="py-3 px-4 text-sm">{req.name}</td>
                  <td className="py-3 px-4 text-sm">
                    {[req.vehicle_make, req.vehicle_model].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {new Date(req.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <Link
                      href={`/admin/service-requests/${req.id}`}
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
