import type { Pool } from "pg";

export async function deleteExpiredSessions(pool: Pool): Promise<number> {
  const result = await pool.query("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP");
  return result.rowCount ?? 0;
}
