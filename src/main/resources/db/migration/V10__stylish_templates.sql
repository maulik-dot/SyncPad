-- =========================================================================
-- V10: Stylish, Consistent Templates — HTML-based, App Aesthetics
-- =========================================================================
-- Replaces inconsistent markdown templates with HTML that matches SyncPad's
-- design system (Inter, #2563eb accent, 1.65 line-height, 816px max-width)
-- and is 1:1 with PdfExportRenderer's print CSS.

DELETE FROM templates WHERE is_builtin = TRUE;

INSERT INTO templates (title, description, content, category, icon, is_builtin, workspace_id, creator_id)
VALUES
(
    'Meeting Notes — SyncPad Style',
    'Clean, structured meeting notes with agenda, decisions, and action items — matches app aesthetic.',
    '<div style="border-left:4px solid #2563eb; background:#eff6ff; border-radius:0 8px 8px 0; padding:1rem 1.25rem; margin:1.25rem 0;">
  <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
    <span style="background:#2563eb; color:white; width:28px; height:28px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:14px;">📅</span>
    <span style="font-weight:700; color:#1e3a8a; font-size:1.05rem;">Team Meeting Notes</span>
    <span style="margin-left:auto; font-size:0.72rem; color:#64748b; background:white; padding:2px 8px; border-radius:9999px; border:1px solid #cbd5e1;">SyncPad</span>
  </div>
  <div style="font-size:0.85rem; color:#475569; line-height:1.6;">
    <strong>Date:</strong> [Date] &nbsp;•&nbsp; <strong>Attendees:</strong> @Alice, @Bob, @Charlie &nbsp;•&nbsp; <strong>Facilitator:</strong> [Name]
  </div>
</div>

<h1 style="font-size:1.6rem; font-weight:700; color:#0f172a; border-bottom:2px solid #e2e8f0; padding-bottom:0.5rem; margin:1.5rem 0 1rem 0;">🎯 Objectives</h1>
<ul style="margin:0.5rem 0 1rem 1.25rem; line-height:1.65;">
  <li>Review sprint deliverables and release status</li>
  <li>Unblock dependencies across platform teams</li>
</ul>

<h2 style="font-size:1.25rem; font-weight:600; color:#0f172a; margin:1.25rem 0 0.5rem 0;">📋 Agenda & Discussion</h2>
<div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin:0.75rem 0;">
  <div style="font-weight:600; color:#0f172a; margin-bottom:0.5rem;">1. Current Sprint Progress</div>
  <ul style="margin:0 0 0.75rem 1.25rem; color:#334155;">
    <li>High velocity on real-time sync engine</li>
    <li>Webhook dispatcher nearing completion</li>
  </ul>
  <div style="font-weight:600; color:#0f172a; margin-bottom:0.5rem;">2. Technical Bottlenecks</div>
  <ul style="margin:0 0 0 1.25rem; color:#334155;">
    <li>Postgres pooling & SSL latency</li>
    <li>Verify RabbitMQ routing rules</li>
  </ul>
</div>

<div style="border-left:4px solid #10b981; background:#ecfdf5; border-radius:0 8px 8px 0; padding:0.85rem 1rem; margin:1.25rem 0;">
  <div style="font-weight:700; color:#065f46; display:flex; align-items:center; gap:0.4rem;">⚡ Decisions & Takeaways</div>
  <ul style="margin:0.5rem 0 0 1.25rem; list-style:none; padding:0;">
    <li style="display:flex; gap:0.5rem; align-items:center;"><input type="checkbox" checked disabled style="accent-color:#10b981;"> Standardize webhooks on HMAC-SHA256</li>
    <li style="display:flex; gap:0.5rem; align-items:center;"><input type="checkbox" disabled> Schedule load testing for WebSocket editors</li>
  </ul>
</div>

<h2 style="font-size:1.25rem; font-weight:600; color:#0f172a; margin:1.25rem 0 0.5rem 0;">🚀 Action Items</h2>
<ul style="list-style:none; padding:0; margin:0;">
  <li style="display:flex; gap:0.5rem; padding:0.5rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:0.5rem;"><input type="checkbox" disabled> <span><strong>@Engineer</strong>: Deploy staging and run synthetic suite</span></li>
  <li style="display:flex; gap:0.5rem; padding:0.5rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:0.5rem;"><input type="checkbox" disabled> <span><strong>@Product</strong>: Update client-facing release notes</span></li>
</ul>',
    'General',
    'calendar',
    TRUE,
    NULL,
    NULL
),
(
    'Product RFC — SyncPad Style',
    'Pitch new features with problem, solution, UX flow, and success metrics — clean and consistent.',
    '<div style="text-align:center; padding:1.25rem; background:linear-gradient(135deg,#eff6ff 0%,#f5f3ff 100%); border:1px solid #cbd5e1; border-radius:12px; margin:1rem 0;">
  <div style="width:48px; height:48px; background:#2563eb; color:white; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; font-size:20px; margin-bottom:0.75rem;">📄</div>
  <div style="font-size:1.5rem; font-weight:800; color:#0f172a;">RFC: [Feature Title]</div>
  <div style="font-size:0.85rem; color:#64748b; margin-top:0.35rem;">Author: [Your Name] • Status: <span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:600;">In Review</span> • Target: Q4</div>
</div>

<h2 style="font-size:1.25rem; font-weight:700; color:#0f172a; border-left:4px solid #2563eb; padding-left:0.75rem; margin:1.5rem 0 0.75rem 0;">1. Problem Statement & User Need</h2>
<p style="color:#334155; line-height:1.65;">Describe the pain point our users experience. Why does this matter now? Use data and user quotes.</p>

<h2 style="font-size:1.25rem; font-weight:700; color:#0f172a; border-left:4px solid #2563eb; padding-left:0.75rem; margin:1.5rem 0 0.75rem 0;">2. Proposed Solution</h2>
<p style="color:#334155; line-height:1.65;">High-level summary of the capability and how it solves the problem.</p>

<div style="background:#0f172a; color:#e2e8f0; border-radius:8px; padding:1rem; font-family:''JetBrains Mono'',monospace; font-size:0.82rem; margin:1rem 0;">
  <div style="color:#94a3b8; font-size:0.7rem; margin-bottom:0.5rem; letter-spacing:0.05em;">USER JOURNEY</div>
  <div>Step 1: User initiates workflow from dashboard</div>
  <div>Step 2: Configuration modal captures parameters</div>
  <div>Step 3: System executes and reports status</div>
</div>

<h2 style="font-size:1.25rem; font-weight:700; color:#0f172a; border-left:4px solid #2563eb; padding-left:0.75rem; margin:1.5rem 0 0.75rem 0;">3. Key Metrics & Success Criteria</h2>
<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin:0.75rem 0;">
  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem; text-align:center;">
    <div style="font-size:1.5rem; font-weight:800; color:#2563eb;">40%</div>
    <div style="font-size:0.75rem; color:#64748b;">Adoption in 30 days</div>
  </div>
  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem; text-align:center;">
    <div style="font-size:1.5rem; font-weight:800; color:#2563eb;">&lt;50ms</div>
    <div style="font-size:0.75rem; color:#64748b;">Interaction latency</div>
  </div>
</div>

<div style="border-left:4px solid #f59e0b; background:#fffbeb; border-radius:0 8px 8px 0; padding:0.85rem 1rem; margin:1.25rem 0;">
  <div style="font-weight:700; color:#92400e;">Security & Privacy</div>
  <div style="font-size:0.85rem; color:#78350f; margin-top:0.35rem;">RBAC validation • Audit log emission for compliance</div>
</div>',
    'Product',
    'file-text',
    TRUE,
    NULL,
    NULL
),
(
    'Engineering Design Doc — SyncPad Style',
    'Architecture blueprint with system context, data model, and failure modes — consistent styling.',
    '<div style="background:#0f172a; color:#e2e8f0; border-radius:12px; padding:1.5rem; margin:1rem 0; border:1px solid #1e293b;">
  <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem;">
    <div style="width:40px; height:40px; background:#2563eb; border-radius:8px; display:flex; align-items:center; justify-content:center;">🏗️</div>
    <div>
      <div style="font-weight:800; font-size:1.15rem;">Engineering Design Doc</div>
      <div style="font-size:0.8rem; color:#94a3b8;">[System Architecture] • [Date]</div>
    </div>
    <span style="margin-left:auto; background:#1e293b; color:#cbd5e1; padding:4px 8px; border-radius:9999px; font-size:0.7rem; border:1px solid #334155;">SyncPad</span>
  </div>
  <div style="font-size:0.85rem; color:#cbd5e1; line-height:1.5;">
    <strong style="color:white;">Author:</strong> [Lead Architect] &nbsp;•&nbsp; <strong style="color:white;">Reviewers:</strong> [Reviewers]
  </div>
</div>

<h2 style="font-size:1.25rem; font-weight:700; color:#0f172a; border-bottom:2px solid #e2e8f0; padding-bottom:0.5rem; margin:1.5rem 0 1rem 0;">1. Executive Summary</h2>
<p style="color:#334155; line-height:1.65;">Concise technical summary of architectural changes and impacted components.</p>

<h2 style="font-size:1.25rem; font-weight:700; color:#0f172a; margin:1.5rem 0 0.75rem 0;">2. System Context & Architecture</h2>
<div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:1rem; text-align:center; font-family:''JetBrains Mono'',monospace; font-size:0.75rem; color:#475569; margin:0.75rem 0;">
  <div>[Client App] → [Nginx TLS] → [Spring Boot Core]</div>
  <div style="margin:0.5rem 0; color:#2563eb;">├──→ [PostgreSQL Primary] &nbsp; ├──→ [RabbitMQ Cluster]</div>
</div>

<h2 style="font-size:1.25rem; font-weight:700; color:#0f172a; margin:1.5rem 0 0.75rem 0;">3. Data Model & Schema</h2>
<ul style="margin:0.5rem 0 1rem 1.25rem; color:#334155; line-height:1.65;">
  <li>New tables, foreign keys, indexes</li>
  <li>Backward compatibility & zero-downtime migration</li>
</ul>

<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin:1rem 0;">
  <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:0.85rem;">
    <div style="font-size:0.75rem; font-weight:700; color:#065f46;">P99 Latency</div>
    <div style="font-size:1.25rem; font-weight:800; color:#059669;">&lt;15ms</div>
  </div>
  <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:0.85rem;">
    <div style="font-size:0.75rem; font-weight:700; color:#1e40af;">WebSocket Sessions</div>
    <div style="font-size:1.25rem; font-weight:800; color:#2563eb;">10k / instance</div>
  </div>
</div>

<div style="border-left:4px solid #ef4444; background:#fef2f2; border-radius:0 8px 8px 0; padding:0.85rem 1rem; margin:1.25rem 0;">
  <div style="font-weight:700; color:#991b1b;">Failure Modes & Recovery</div>
  <div style="font-size:0.85rem; color:#7f1d1d; margin-top:0.35rem;">Timeout fallbacks • Dead-letter queues for webhook retry</div>
</div>',
    'Engineering',
    'cpu',
    TRUE,
    NULL,
    NULL
),
(
    'Sprint Retrospective — SyncPad Style',
    'Evaluate sprint health with consistent, styled sections and committed actions.',
    '<div style="display:flex; align-items:center; gap:0.75rem; background:linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%); border:1px solid #cbd5e1; border-radius:12px; padding:1rem; margin:1rem 0;">
  <div style="width:44px; height:44px; background:#10b981; color:white; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px;">🔄</div>
  <div>
    <div style="font-weight:800; color:#0f172a;">Sprint Retrospective — Sprint #[X]</div>
    <div style="font-size:0.85rem; color:#475569;">Theme: Performance, Reliability & Roadmap • [Date]</div>
  </div>
  <span style="margin-left:auto; background:white; border:1px solid #cbd5e1; padding:4px 8px; border-radius:9999px; font-size:0.7rem; color:#64748b;">SyncPad</span>
</div>

<h2 style="font-size:1.1rem; font-weight:700; color:#065f46; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:0.6rem 0.85rem; margin:1.25rem 0 0.75rem 0;">🌟 What Went Exceptionally Well</h2>
<ul style="margin:0 0 1rem 1.25rem; color:#334155; line-height:1.65;">
  <li>Zero regression deployments</li>
  <li>Smooth migration to WebSocket architecture</li>
  <li>Fast turnaround on customer feedback</li>
</ul>

<h2 style="font-size:1.1rem; font-weight:700; color:#991b1b; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:0.6rem 0.85rem; margin:1.25rem 0 0.75rem 0;">🛑 What Needs Improvement</h2>
<ul style="margin:0 0 1rem 1.25rem; color:#334155; line-height:1.65;">
  <li>Flaky integration tests under heavy CI load</li>
  <li>Brief webhook receiver docs initially</li>
</ul>

<h2 style="font-size:1.1rem; font-weight:700; color:#92400e; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:0.6rem 0.85rem; margin:1.25rem 0 0.75rem 0;">💡 Ideas for Future Experiments</h2>
<ul style="margin:0 0 1rem 1.25rem; color:#334155; line-height:1.65;">
  <li>Automated benchmark checks on every PR</li>
  <li>Pre-warmed connection pools in dev</li>
</ul>

<div style="border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; margin:1.25rem 0;">
  <div style="background:#0f172a; color:white; padding:0.6rem 0.85rem; font-weight:700; font-size:0.9rem;">📌 Committed Action Items</div>
  <div style="padding:0.85rem;">
    <div style="display:flex; gap:0.5rem; padding:0.5rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:0.5rem;"><input type="checkbox" disabled> <span>Refactor test harness to mock network</span></div>
    <div style="display:flex; gap:0.5rem; padding:0.5rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;"><input type="checkbox" disabled> <span>Add OpenAPI / Swagger docs</span></div>
  </div>
</div>',
    'Agile',
    'refresh-cw',
    TRUE,
    NULL,
    NULL
),
(
    '1:1 Sync & Growth — SyncPad Style',
    'Weekly sync with consistent pulse, wins, roadblocks, and growth sections.',
    '<div style="background:linear-gradient(135deg,#faf5ff 0%,#eff6ff 100%); border:1px solid #cbd5e1; border-radius:12px; padding:1.25rem; margin:1rem 0; text-align:center;">
  <div style="width:48px; height:48px; background:#7c3aed; color:white; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; font-size:20px; margin:0 auto 0.75rem;">👥</div>
  <div style="font-weight:800; font-size:1.15rem; color:#0f172a;">1:1 Sync: [Manager] & [Team Member]</div>
  <div style="font-size:0.85rem; color:#64748b; margin-top:0.25rem;">[Date] • Growth & Priorities • SyncPad</div>
</div>

<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin:1.25rem 0;">
  <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:0.85rem;">
    <div style="font-weight:700; color:#1e40af; font-size:0.9rem; margin-bottom:0.35rem;">🎯 Pulse & Sentiment</div>
    <div style="font-size:0.85rem; color:#334155; line-height:1.5;">
      <div>• Workload & energy last 2 weeks?</div>
      <div>• Most energizing project?</div>
    </div>
  </div>
  <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:0.85rem;">
    <div style="font-weight:700; color:#065f46; font-size:0.9rem; margin-bottom:0.35rem;">🚀 Key Wins</div>
    <div style="font-size:0.85rem; color:#334155; line-height:1.5;">
      <div>• Accomplishment 1</div>
      <div>• Accomplishment 2</div>
    </div>
  </div>
</div>

<div style="border-left:4px solid #f59e0b; background:#fffbeb; border-radius:0 8px 8px 0; padding:0.85rem 1rem; margin:1.25rem 0;">
  <div style="font-weight:700; color:#92400e;">🚧 Roadblocks & To Unblock</div>
  <div style="font-size:0.85rem; color:#78350f; margin-top:0.35rem;">Cross-team dependencies or tool hurdles slowing you down?</div>
</div>

<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin:1.25rem 0;">
  <div style="font-weight:700; color:#0f172a; margin-bottom:0.5rem;">📈 Long-Term Growth & Learning</div>
  <div style="font-size:0.85rem; color:#475569;">Goals for quarter • Skill development • Mentorship opportunities</div>
  <ul style="margin:0.5rem 0 0 1.25rem; font-size:0.85rem; color:#334155;">
    <li>Goal 1</li>
    <li>Skill to develop</li>
  </ul>
</div>',
    'Management',
    'users',
    TRUE,
    NULL,
    NULL
)
ON CONFLICT DO NOTHING;
