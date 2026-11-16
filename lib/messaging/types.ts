import type { SegmentProfile } from "./segments";

export interface SendOpts {
  /** SMS gönderici başlığı (salon smsSenderName). */
  sender?: string | null;
  /** WhatsApp şablon adı / dili / gövde parametreleri. */
  template?: string;
  lang?: string;
  params?: string[];
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
  /** Sağlayıcının faturaladığı birim (SMS: segment; WhatsApp/e-posta: 0). Defter düşümü bundan bağımsız, segment sayısıyla yapılır. */
  cost: number;
}

export interface MessageProvider {
  name: string;
  channel: "sms" | "whatsapp";
  segmentProfile?: SegmentProfile;
  send(to: string, text: string, opts?: SendOpts): Promise<SendResult>;
}

export interface EmailProvider {
  name: string;
  send(to: string, subject: string, text: string): Promise<{ ok: boolean; providerId?: string; error?: string }>;
}

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface ProviderDeps {
  env: Record<string, string | undefined>;
  fetch: FetchLike;
}
