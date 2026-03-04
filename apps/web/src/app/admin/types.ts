export type Product = {
  id: number;
  sku: string;
  oem: string | null;
  brand: string | null;
  name: string;
  description: string | null;
  price: number | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: number;
  uuid: string;
  type: 'vin' | 'callback' | 'product' | 'parts_search';
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

export type ServiceRequest = {
  id: number;
  uuid: string;
  status: string;
  vehicle_type: 'passenger' | 'truck';
  service_type: string;
  name: string;
  phone: string;
  email: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vin: string | null;
  mileage: number | null;
  description: string | null;
  preferred_date: string | null;
  consent_given: boolean;
  created_at: string;
};
