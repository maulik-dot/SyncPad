CREATE TABLE IF NOT EXISTS ai_generations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    document_id BIGINT REFERENCES document(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    model_used VARCHAR(100),
    prompt TEXT,
    selected_text TEXT,
    response_text TEXT,
    tone VARCHAR(50),
    estimated_tokens INT,
    latency_ms BIGINT,
    is_stream BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_doc ON ai_generations(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generations_user ON ai_generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generations_created ON ai_generations(created_at DESC);
