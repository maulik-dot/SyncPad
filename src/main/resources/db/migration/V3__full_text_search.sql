-- Migration V3: Full-text search index for documents
CREATE INDEX IF NOT EXISTS idx_document_fulltext ON document 
USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));
-- Migration V3: Search and filtering indexes for documents
CREATE INDEX IF NOT EXISTS idx_document_title ON document(title);
CREATE INDEX IF NOT EXISTS idx_document_workspace ON document(workspace_name);
CREATE INDEX IF NOT EXISTS idx_document_trashed ON document(is_trashed);
