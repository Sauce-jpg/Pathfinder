import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
  },
});
```

This forces PKCE flow, which means Google will redirect to `/auth/callback?code=...` instead of dumping `#access_token` in the URL hash. Your `callback/route.ts` already handles the `?code=` exchange correctly, so once this is in place the full flow should work:
```
Google → /auth/callback?code=xxx → exchange for session → redirect to /
