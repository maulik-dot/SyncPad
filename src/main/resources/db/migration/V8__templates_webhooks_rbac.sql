-- =========================================================================
-- V8: Templates, Webhooks, and RBAC / Guest Expiration
-- =========================================================================

-- 1. Add expiration timestamp column to permissions tables
ALTER TABLE document_permissions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL;
ALTER TABLE workspace_permissions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL;

-- 2. Templates and Blueprints Table
CREATE TABLE IF NOT EXISTS templates (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    category VARCHAR(100),
    icon VARCHAR(100),
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE,
    creator_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_workspace ON templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_templates_builtin ON templates(is_builtin);

-- 3. Webhooks Table
CREATE TABLE IF NOT EXISTS webhooks (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(1024) NOT NULL,
    secret VARCHAR(255),
    events VARCHAR(255) NOT NULL DEFAULT '*',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhooks(workspace_id);

-- 4. Seed Built-in Enterprise Blueprints
INSERT INTO templates (title, description, content, category, icon, is_builtin, workspace_id, creator_id)
VALUES
(
    'Meeting Notes & Decisions',
    'Structure team meetings with agenda items, real-time discussion notes, and actionable next steps.',
    '# Team Meeting Notes

**Date:** [Date]  
**Attendees:** @Alice, @Bob, @Charlie  
**Facilitator:** [Name]  

---

## 🎯 Objectives
- Review sprint deliverables and current release status
- Unblock critical dependencies across platform teams

---

## 📋 Agenda & Discussion Points
1. **Current Sprint Progress**
   - High velocity on real-time sync engine
   - Webhook dispatcher pipeline nearing completion
2. **Technical Bottlenecks**
   - Review Postgres connection pooling and SSL handshake latency
   - Verify Redis/RabbitMQ message routing rules

---

## ⚡ Decisions & Takeaways
- [x] Standardize outbound webhooks on HMAC-SHA256 signatures
- [ ] Schedule load testing for concurrent WebSocket editors

---

## 🚀 Action Items
- [ ] **@Engineer**: Deploy staging cluster and run synthetic test suite
- [ ] **@Product**: Update client-facing release notes
',
    'General',
    'calendar',
    TRUE,
    NULL,
    NULL
),
(
    'Product RFC (Request for Comments)',
    'A standardized template for pitching and designing new user-facing product features.',
    '# RFC: [Feature Title]

**Author:** [Your Name]  
**Status:** In Review  
**Target Release:** Q4  

---

## 1. Problem Statement & User Need
Describe the pain point our users are experiencing. Why does this matter now?

---

## 2. Proposed Solution
High-level summary of the capability being introduced and how it solves the user problem.

---

## 3. User Experience & Wireframe Flow
- **Step 1:** User initiates workflow from dashboard
- **Step 2:** Configuration modal captures parameters
- **Step 3:** System executes and reports status feedback

---

## 4. Key Metrics & Success Criteria
- Adoption rate > 40% within 30 days
- Sub-50ms interaction latency on standard network conditions

---

## 5. Security & Privacy Considerations
- Access control validation (RBAC)
- Audit log emission for compliance tracing
',
    'Product',
    'file-text',
    TRUE,
    NULL,
    NULL
),
(
    'Engineering Design Doc',
    'Comprehensive architecture blueprint covering system context, trade-offs, and rollout.',
    '# Engineering Design Doc: [System Architecture]

**Author:** [Lead Architect / Engineer]  
**Reviewers:** [Reviewers]  
**Date:** [Current Date]  

---

## 1. Executive Summary
Concise technical summary of the architectural changes and components impacted.

---

## 2. System Context & Architecture
```
[Client App] --> [TLS Reverse Proxy / Nginx] --> [Spring Boot Core]
                                                       │
                           ┌───────────────────────────┴───────────────────────────┐
                           ▼                                                       ▼
                 [(PostgreSQL Primary)]                                    [(RabbitMQ Cluster)]
```

---

## 3. Data Model & Schema Migrations
- Explain newly introduced tables, foreign keys, and indexes.
- Describe backward compatibility and zero-downtime migration strategy.

---

## 4. Latency & Scalability Characteristics
- P99 target response time: < 15ms
- Concurrent WebSocket sessions: up to 10,000 per instance

---

## 5. Failure Modes & Disaster Recovery
- Connection timeout fallbacks
- Dead-letter queues for asynchronous webhook retry
',
    'Engineering',
    'cpu',
    TRUE,
    NULL,
    NULL
),
(
    'Sprint Retrospective',
    'Evaluate what went well, what could be improved, and commit to continuous improvement.',
    '# Sprint Retrospective - Sprint #[X]

**Sprint Theme:** Performance, Reliability & Roadmap Expansion  
**Date:** [Date]  

---

## 🌟 What Went Exceptionally Well
- Zero regression deployments throughout the sprint
- Smooth migration to modern WebSocket architecture
- Fast turnaround on customer feedback

---

## 🛑 What Needs Improvement
- Flaky automated integration tests during heavy CI runner load
- Documentation for third-party webhook receivers was initially brief

---

## 💡 Ideas for Future Experiments
- Automated benchmark checks on every pull request
- Pre-warmed connection pools in dev environments

---

## 📌 Committed Action Items
- [ ] Refactor test harness to mock network dependencies
- [ ] Add OpenAPI / Swagger schema documentation
',
    'Agile',
    'refresh-cw',
    TRUE,
    NULL,
    NULL
),
(
    '1:1 Sync & Growth Framework',
    'Structured weekly or bi-weekly sync between manager and team member focusing on priorities and growth.',
    '# 1:1 Sync: [Manager] & [Team Member]

**Date:** [Date]  

---

## 🎯 Pulse & Sentiment Check
- How has your workload and energy been over the past two weeks?
- What was the most energizing project you touched recently?

---

## 🚀 Key Wins & Progress Since Last Sync
- Accomplishment 1
- Accomplishment 2

---

## 🚧 Roadblocks & Things to Unblock
- Are there cross-team dependencies or tool hurdles slowing you down?

---

## 📈 Long-Term Growth & Learning Goals
- Goals for the quarter
- Skill development and mentorship opportunities
',
    'Management',
    'users',
    TRUE,
    NULL,
    NULL
)
ON CONFLICT DO NOTHING;
