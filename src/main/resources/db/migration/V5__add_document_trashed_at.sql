ALTER TABLE document ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMP NULL;
CREATE INDEX IF NOT EXISTS idx_document_trashed_at ON document(trashed_at);
