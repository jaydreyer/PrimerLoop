import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as unknown as {
  __apiRateLimitStore?: Map<string, RateLimitEntry>;
};

const rateLimitStore = globalForRateLimit.__apiRateLimitStore ?? new Map<string, RateLimitEntry>();
globalForRateLimit.__apiRateLimitStore = rateLimitStore;

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

function isRateLimited(request: NextRequest): boolean {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "unknown";
  const clientIp = forwardedFor.split(",")[0]?.trim() || "unknown";
  const key = `${clientIp}:${request.nextUrl.pathname}`;
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return false;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && isRateLimited(request)) {
    // Dev-only in-memory limiter; production should use distributed storage.
    return applySecurityHeaders(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );
  }

  let response = NextResponse.next({
    request,
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    return applySecurityHeaders(response);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
        }

        response = NextResponse.next({
          request,
        });

        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie);
        }
      },
    },
  });

  // Refresh session/cookies for server-side auth access.
  await supabase.auth.getUser();

  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
