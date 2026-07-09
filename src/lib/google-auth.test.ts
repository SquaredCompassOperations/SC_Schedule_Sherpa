import { describe, expect, it } from "vitest";
import {
  GOOGLE_DRIVE_SCOPES,
  getStoredGoogleProviderToken,
  persistGoogleProviderTokens,
} from "./google-auth";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("google auth helpers", () => {
  it("requests the minimal Drive scope needed for selected files", () => {
    expect(GOOGLE_DRIVE_SCOPES).toBe("https://www.googleapis.com/auth/drive.file");
  });

  it("stores and retrieves Supabase provider tokens", () => {
    const storage = createMemoryStorage();

    persistGoogleProviderTokens(
      {
        provider_token: "provider-access-token",
        provider_refresh_token: "provider-refresh-token",
      },
      storage,
    );

    expect(getStoredGoogleProviderToken(storage)).toBe("provider-access-token");
  });

  it("clears provider tokens when the session is missing", () => {
    const storage = createMemoryStorage();
    persistGoogleProviderTokens({ provider_token: "old-token" }, storage);

    persistGoogleProviderTokens(null, storage);

    expect(getStoredGoogleProviderToken(storage)).toBeNull();
  });
});
