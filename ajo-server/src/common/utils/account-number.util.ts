/**
 * Generates a random 10-digit wallet account number (starts with 8),
 * matching the format used for user wallets (see auth.service.ts).
 * Caller is responsible for collision-checking against the wallets table.
 */
export function generateAccountNumber(): string {
  const suffix = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `8${suffix}`.slice(0, 10);
}
