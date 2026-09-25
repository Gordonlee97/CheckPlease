// None of these are guaranteed at runtime. The app deploys without Azure
// (Claude-only scanning), without Upstash (no rate limiting), and the
// NEXT_PUBLIC_ overrides only exist when the client is served from a
// different origin than the API. Declaring them optional makes TypeScript
// enforce the guards the code already has, rather than trusting a `string`
// that is routinely undefined.
declare namespace NodeJS {
  interface ProcessEnv {
    // Receipt scanning
    ANTHROPIC_API_KEY?: string
    AZURE_DI_ENDPOINT?: string
    AZURE_DI_KEY?: string

    // Rate limiting — either pair works; Vercel KV provisions the KV_ names
    UPSTASH_REDIS_REST_URL?: string
    UPSTASH_REDIS_REST_TOKEN?: string
    KV_REST_API_URL?: string
    KV_REST_API_TOKEN?: string

    // Client-side overrides (see README → Environment variables)
    NEXT_PUBLIC_SCAN_API_URL?: string
    NEXT_PUBLIC_SHARE_BASE_URL?: string
  }
}
