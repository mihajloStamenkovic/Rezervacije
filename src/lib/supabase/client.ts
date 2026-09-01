/**
 * The browser Supabase client — publishable key only, respects RLS.
 *
 * Only ever import this from a Client Component (`"use client"`). Create a
 * fresh client per call rather than a module singleton — that is the
 * pattern `@supabase/ssr` is built around, and `createBrowserClient` is
 * cheap to call repeatedly.
 */
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/env";

export function supabaseBrowser() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
