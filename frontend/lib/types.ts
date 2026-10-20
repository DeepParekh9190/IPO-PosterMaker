export type IpoStatus = "upcoming" | "open" | "closed" | "listed";
export type Category = "Mainboard" | "SME";
export type Lang = "en" | "hi" | "gu";
export type TemplatePlan = "free" | "pro";

export interface Ipo {
  id: string;
  company_name: string;
  category: Category;
  open_date: string | null;
  close_date: string | null;
  allotment_date: string | null;
  listing_date: string | null;
  price_min: number | null;
  price_max: number | null;
  lot_size: number | null;
  issue_size_cr: number | null;
  gmp: number | null;
  gmp_percent: number | null;
  subscription: string | null;
  status: IpoStatus;
  min_investment: number | null;
  source_url: string | null;
  source_name: string;
  logo_url: string | null;
  updated_at: string;
  verified: boolean;
  hidden: boolean;
  manual: boolean;
  is_demo: boolean;
  notes: string | null;
}

export interface IpoListMeta {
  last_updated: string | null;
  stale: boolean;
  provider: string;
  demo_mode: boolean;
  source_error: string | null;
  total: number;
}

export interface IpoListResponse {
  items: Ipo[];
  meta: IpoListMeta;
}

export interface User {
  id: string;
  email: string;
  role: "client" | "admin";
  status: string;
  business_name: string | null;
  created_at: string;
}

export interface PlanFeatures {
  watermark_free: boolean;
  daily_exports: number;
  premium_templates: boolean;
  save_brand: boolean;
  extras: Record<string, boolean>;
}

export interface Plan {
  id: string;
  name: string;
  price_inr: number;
  period: string;
  description: string;
  features: PlanFeatures;
  active: boolean;
}

export interface Subscription {
  user_id: string;
  plan_id: string;
  status: string;
  provider: string | null;
  provider_ref: string | null;
  current_period_end: string | null;
  updated_at: string;
}

export interface Me {
  user: User;
  plan: Plan;
  entitlements: PlanFeatures;
  usage: { key: string; exports_today: number };
  subscription: Subscription | null;
}

export interface Template {
  key: string;
  name: string;
  plan: TemplatePlan;
  enabled: boolean;
  is_default: boolean;
  description: string;
}

export interface AppConfig {
  app_name: string;
  support_email: string;
  source_mode: string;
  demo_mode: boolean;
  default_language: Lang;
  default_width: number;
  default_height: number;
  watermark_text: string;
  templates: Template[];
  payments_mode: "test" | "live";
  maintenance_mode: boolean;
}

export interface BrandProfile {
  business_name: string;
  logo_data_url: string | null;
  logo_mime: string | null;
  template_key: string;
  color_theme: string;
  footer_text: string;
}

export interface ExportGrant {
  token: string;
  watermark: boolean;
  watermark_text: string;
  template_key: string;
  width: number;
  height: number;
  expires_at: number;
  plan_id: string;
}
