import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const GOOGLE_DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file";

const GOOGLE_PROVIDER_TOKEN_KEY = "schedule_sherpa_google_provider_token";
const GOOGLE_PROVIDER_REFRESH_TOKEN_KEY = "schedule_sherpa_google_provider_refresh_token";

type GoogleProviderSession = Pick<Session, "provider_token" | "provider_refresh_token"> | null;

function browserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function persistGoogleProviderTokens(
  session: GoogleProviderSession,
  storage: Storage | null = browserStorage(),
) {
  if (!storage) return;

  if (!session) {
    storage.removeItem(GOOGLE_PROVIDER_TOKEN_KEY);
    storage.removeItem(GOOGLE_PROVIDER_REFRESH_TOKEN_KEY);
    return;
  }

  if (session.provider_token) {
    storage.setItem(GOOGLE_PROVIDER_TOKEN_KEY, session.provider_token);
  }

  if (session.provider_refresh_token) {
    storage.setItem(GOOGLE_PROVIDER_REFRESH_TOKEN_KEY, session.provider_refresh_token);
  }
}

export function clearGoogleProviderTokens(storage: Storage | null = browserStorage()) {
  persistGoogleProviderTokens(null, storage);
}

export function getStoredGoogleProviderToken(storage: Storage | null = browserStorage()) {
  return storage?.getItem(GOOGLE_PROVIDER_TOKEN_KEY) ?? null;
}

export async function signInWithGoogle(redirectTo: string) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: `openid email profile ${GOOGLE_DRIVE_SCOPES}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
}
