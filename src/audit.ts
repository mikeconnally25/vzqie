import type { AuditLogEntry, AuditLogger } from "./types.js";

export const AUDIT_LOG_SCHEMA = `
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  action TEXT NOT NULL,
  username TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_username ON audit_log(username);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
`.trim();

export class InMemoryAuditLogger implements AuditLogger {
  readonly entries: AuditLogEntry[] = [];

  async log(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}
