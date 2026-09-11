-- =========================================================================
-- V11: Simple, Tool-Based Templates — No Boxes, Only Text Styles & Fonts
-- =========================================================================
-- Replaces V10's boxed/gradient templates with clean, minimal HTML using
-- only editor-supported tools: headings, paragraphs, lists, blockquote,
-- code, tables, and inline styles (fonts, sizes, colors, alignment).
-- Matches SyncPad's simple aesthetic: Inter, #0f172a, 1.65 line-height.

DELETE FROM templates WHERE is_builtin = TRUE;

INSERT INTO templates (title, description, content, category, icon, is_builtin, workspace_id, creator_id)
VALUES
(
    'Meeting Notes',
    'Simple agenda, discussion, and action items — only headings, lists, and text styles.',
    '<h1>Team Meeting Notes</h1>
<p><strong>Date:</strong> [Date] &nbsp;•&nbsp; <strong>Attendees:</strong> @Alice, @Bob, @Charlie &nbsp;•&nbsp; <strong>Facilitator:</strong> [Name]</p>
<hr>
<h2>Objectives</h2>
<ul>
  <li>Review sprint deliverables and release status</li>
  <li>Unblock dependencies across platform teams</li>
</ul>
<h2>Agenda & Discussion</h2>
<h3>1. Current Sprint Progress</h3>
<ul>
  <li>High velocity on real-time sync engine</li>
  <li>Webhook dispatcher nearing completion</li>
</ul>
<h3>2. Technical Bottlenecks</h3>
<ul>
  <li>Postgres pooling & SSL latency</li>
  <li>Verify RabbitMQ routing rules</li>
</ul>
<h2>Decisions & Takeaways</h2>
<ul>
  <li>Standardize webhooks on HMAC-SHA256</li>
  <li>Schedule load testing for WebSocket editors</li>
</ul>
<h2>Action Items</h2>
<ul>
  <li><strong>@Engineer:</strong> Deploy staging and run synthetic suite</li>
  <li><strong>@Product:</strong> Update client-facing release notes</li>
</ul>',
    'General',
    'calendar',
    TRUE,
    NULL,
    NULL
),
(
    'Product RFC',
    'Simple RFC with problem, solution, steps, and metrics — headings and lists only.',
    '<h1>RFC: [Feature Title]</h1>
<p><strong>Author:</strong> [Your Name] &nbsp;•&nbsp; <strong>Status:</strong> In Review &nbsp;•&nbsp; <strong>Target:</strong> Q4</p>
<hr>
<h2>1. Problem Statement & User Need</h2>
<p>Describe the pain point our users experience. Why does this matter now? Use data and user quotes.</p>
<h2>2. Proposed Solution</h2>
<p>High-level summary of the capability and how it solves the problem.</p>
<h3>User Journey</h3>
<ol>
  <li>User initiates workflow from dashboard</li>
  <li>Configuration modal captures parameters</li>
  <li>System executes and reports status</li>
</ol>
<h2>3. Key Metrics & Success Criteria</h2>
<ul>
  <li>Adoption rate &gt; 40% within 30 days</li>
  <li>Sub-50ms interaction latency</li>
</ul>
<h2>4. Security & Privacy</h2>
<ul>
  <li>RBAC validation</li>
  <li>Audit log emission for compliance</li>
</ul>',
    'Product',
    'file-text',
    TRUE,
    NULL,
    NULL
),
(
    'Engineering Design Doc',
    'Simple architecture blueprint — headings, lists, and code.',
    '<h1>Engineering Design Doc: [System Architecture]</h1>
<p><strong>Author:</strong> [Lead Architect] &nbsp;•&nbsp; <strong>Reviewers:</strong> [Reviewers] &nbsp;•&nbsp; <strong>Date:</strong> [Current Date]</p>
<hr>
<h2>1. Executive Summary</h2>
<p>Concise technical summary of architectural changes and impacted components.</p>
<h2>2. System Context & Architecture</h2>
<pre><code>[Client App] --&gt; [Nginx TLS] --&gt; [Spring Boot Core]
                           ├──→ [PostgreSQL Primary]
                           └──→ [RabbitMQ Cluster]</code></pre>
<h2>3. Data Model & Schema</h2>
<ul>
  <li>New tables, foreign keys, indexes</li>
  <li>Backward compatibility & zero-downtime migration</li>
</ul>
<h2>4. Latency & Scalability</h2>
<ul>
  <li>P99 target &lt; 15ms</li>
  <li>Concurrent WebSocket sessions: up to 10,000 per instance</li>
</ul>
<h2>5. Failure Modes & Recovery</h2>
<ul>
  <li>Connection timeout fallbacks</li>
  <li>Dead-letter queues for webhook retry</li>
</ul>',
    'Engineering',
    'cpu',
    TRUE,
    NULL,
    NULL
),
(
    'Sprint Retrospective',
    'Simple retro with what went well, needs improvement, and actions — headings and lists.',
    '<h1>Sprint Retrospective — Sprint #[X]</h1>
<p><strong>Theme:</strong> Performance, Reliability & Roadmap &nbsp;•&nbsp; <strong>Date:</strong> [Date]</p>
<hr>
<h2>What Went Well</h2>
<ul>
  <li>Zero regression deployments</li>
  <li>Smooth migration to WebSocket architecture</li>
  <li>Fast turnaround on customer feedback</li>
</ul>
<h2>What Needs Improvement</h2>
<ul>
  <li>Flaky integration tests under heavy CI load</li>
  <li>Brief webhook receiver docs initially</li>
</ul>
<h2>Ideas for Future Experiments</h2>
<ul>
  <li>Automated benchmark checks on every PR</li>
  <li>Pre-warmed connection pools in dev</li>
</ul>
<h2>Committed Action Items</h2>
<ul>
  <li>Refactor test harness to mock network</li>
  <li>Add OpenAPI / Swagger docs</li>
</ul>',
    'Agile',
    'refresh-cw',
    TRUE,
    NULL,
    NULL
),
(
    '1:1 Sync',
    'Simple 1:1 with pulse, wins, roadblocks, and growth — headings and lists.',
    '<h1>1:1 Sync: [Manager] &amp; [Team Member]</h1>
<p><strong>Date:</strong> [Date] &nbsp;•&nbsp; Growth & Priorities</p>
<hr>
<h2>Pulse & Sentiment</h2>
<ul>
  <li>Workload & energy last 2 weeks?</li>
  <li>Most energizing project?</li>
</ul>
<h2>Key Wins & Progress</h2>
<ul>
  <li>Accomplishment 1</li>
  <li>Accomplishment 2</li>
</ul>
<h2>Roadblocks & To Unblock</h2>
<ul>
  <li>Cross-team dependencies or tool hurdles slowing you down?</li>
</ul>
<h2>Long-Term Growth & Learning</h2>
<ul>
  <li>Goals for quarter</li>
  <li>Skill development and mentorship opportunities</li>
</ul>',
    'Management',
    'users',
    TRUE,
    NULL,
    NULL
)
ON CONFLICT DO NOTHING;
