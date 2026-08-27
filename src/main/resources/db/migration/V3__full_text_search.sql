-- Migration V3: Full-text search and filtering indexes for documents
CREATE INDEX IF NOT EXISTS idx_document_title ON document(title);
CREATE INDEX IF NOT EXISTS idx_document_workspace_name ON document(workspace_name);
CREATE INDEX IF NOT EXISTS idx_document_trashed ON document(is_trashed);
