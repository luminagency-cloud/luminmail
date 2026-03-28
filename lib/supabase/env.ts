const requiredPublicEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const requiredServiceEnv = [...requiredPublicEnv, "SUPABASE_SERVICE_ROLE_KEY"] as const;

function missingKeys(keys: readonly string[]) {
  return keys.filter((key) => !process.env[key]);
}

export function hasSupabasePublicEnv() {
  return missingKeys(requiredPublicEnv).length === 0;
}

export function hasSupabaseServiceEnv() {
  return missingKeys(requiredServiceEnv).length === 0;
}

export function getSupabasePublicEnv() {
  const missing = missingKeys(requiredPublicEnv);
  if (missing.length > 0) {
    throw new Error(`Missing Supabase public environment variables: ${missing.join(", ")}`);
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  };
}

export function getSupabaseServiceEnv() {
  const missing = missingKeys(requiredServiceEnv);
  if (missing.length > 0) {
    throw new Error(`Missing Supabase service environment variables: ${missing.join(", ")}`);
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string
  };
}
