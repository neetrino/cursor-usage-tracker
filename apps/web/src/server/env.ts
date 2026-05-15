/** Read a required env var at runtime (handlers, actions, server functions only — never at module init). */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}
