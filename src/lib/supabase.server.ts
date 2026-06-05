import { AsyncLocalStorage } from "node:async_hooks";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import type { CookieSerializeOptions } from "cookie-es";
import ws from "ws";
import type { Database } from "./database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CookieToSet = {
  name: string;
  value: string;
  options?: CookieSerializeOptions;
};

// Node 20 has no native WebSocket — both createClient and createServerClient initialize
// RealtimeClient eagerly. Every Supabase client creation needs this transport option.
const realtimeOpts = { transport: ws as unknown as typeof WebSocket };

type SupabaseServerClientOptions = {
  collectCookies?: CookieToSet[];
};

const requestClientStorage = new AsyncLocalStorage<SupabaseClient<Database>>();

function buildSupabaseServerClient(opts?: SupabaseServerClientOptions) {
  return createServerClient<Database>(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
      },
      realtime: realtimeOpts,
      cookies: {
        getAll() {
          const cookies = getCookies();
          return Object.entries(cookies).map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          if (opts?.collectCookies) {
            opts.collectCookies.push(...cookiesToSet);
            return;
          }
          cookiesToSet.forEach(({ name, value, options }) => {
            setCookie(name, value, options);
          });
        },
      },
    },
  );
}

// SSR-aware client that reads/writes cookies so auth sessions persist across requests.
// Reuses one client per request to avoid concurrent session refresh races.
export function createSupabaseServerClient(opts?: SupabaseServerClientOptions) {
  if (opts?.collectCookies) return buildSupabaseServerClient(opts);

  const cached = requestClientStorage.getStore();
  if (cached) return cached;

  const client = buildSupabaseServerClient(opts);
  requestClientStorage.enterWith(client);
  return client;
}

// Service-role client for server-side writes that bypass RLS.
export function getServiceRoleClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY env var is required");
  return createClient<Database>(url, key, { auth: { persistSession: false }, realtime: realtimeOpts });
}
