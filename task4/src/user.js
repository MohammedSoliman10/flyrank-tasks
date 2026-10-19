/**
 * Return only the fields this API is allowed to expose.
 *
 * Supabase user objects also contain identity/provider metadata. Keeping the
 * response explicit avoids accidentally leaking fields when the provider adds
 * new ones.
 */
export function publicUser(user) {
  return {
    id: user?.id ?? null,
    email: user?.email ?? null,
    created_at: user?.created_at ?? null,
  };
}
