package com.example.syncpad.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.exception.DocumentNotFoundException;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentCommentRepository;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

@Service
public class DocumentExportService {

    private static final Logger log = LoggerFactory.getLogger(DocumentExportService.class);

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final DocumentCommentRepository commentRepository;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    public DocumentExportService(
            DocumentRepository documentRepository,
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            DocumentPermissionRepository permissionRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            DocumentCommentRepository commentRepository,
            AuditLogService auditLogService
    ) {
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.permissionRepository = permissionRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.commentRepository = commentRepository;
        this.auditLogService = auditLogService;

        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));
    }

    private Role getEffectiveRole(Document document, User user) {
        if (document == null || user == null) return null;

        if (document.getOwner() != null && document.getOwner().getId().equals(user.getId())) {
            return Role.OWNER;
        }

        var docPerm = permissionRepository.findByUserAndDocument(user, document);
        if (docPerm.isPresent() && !docPerm.get().isExpired()) {
            Role r = docPerm.get().getRole();
            return (r == Role.RESTRICTED) ? null : r;
        }

        if (document.getWorkspaceName() != null) {
            var wsOpt = workspaceRepository.findByName(document.getWorkspaceName());
            if (wsOpt.isPresent()) {
                Workspace ws = wsOpt.get();
                if (ws.getOwner() != null && ws.getOwner().getId().equals(user.getId())) {
                    return Role.OWNER;
                }
                var wsPerm = workspacePermissionRepository.findByUserAndWorkspace(user, ws);
                if (wsPerm.isPresent() && !wsPerm.get().isExpired()) {
                    return wsPerm.get().getRole();
                }
            }
        }
        return null;
    }

    public ResponseEntity<byte[]> exportDocument(Long documentId, String format, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException("Document not found with ID: " + documentId));

        Role role = getEffectiveRole(document, user);
        if (role == null) {
            throw new PermissionDeniedException("Access denied: You do not have permission to view or export this document");
        }

        String fmt = (format != null) ? format.toLowerCase().trim() : "md";
        String baseName = sanitizeFilename(document.getTitle());
        byte[] contentBytes;
        String contentType;
        String filename;

        switch (fmt) {
            case "md":
            case "markdown":
                filename = baseName + ".md";
                contentType = "text/markdown; charset=UTF-8";
                contentBytes = generateMarkdown(document);
                break;

            case "txt":
            case "text":
                filename = baseName + ".txt";
                contentType = "text/plain; charset=UTF-8";
                contentBytes = generatePlainText(document);
                break;

            case "html":
                filename = baseName + ".html";
                contentType = "text/html; charset=UTF-8";
                contentBytes = generateHtml(document);
                break;

            case "json":
                filename = baseName + ".json";
                contentType = "application/json; charset=UTF-8";
                contentBytes = generateJson(document);
                break;

            case "pdf":
                filename = baseName + ".pdf";
                contentType = "application/pdf";
                contentBytes = generatePdf(document);
                break;

            case "zip":
            case "bundle":
                filename = baseName + "-bundle.zip";
                contentType = "application/zip";
                contentBytes = generateZipBundle(document, baseName);
                break;

            default:
                throw new IllegalArgumentException("Unsupported export format: " + format + ". Supported: md, txt, html, json, pdf, zip");
        }

        if (auditLogService != null) {
            auditLogService.log(user, null, document, "DOCUMENT_EXPORTED", "Exported as " + fmt.toUpperCase() + " (" + contentBytes.length + " bytes)");
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + urlEncode(filename))
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .body(contentBytes);
    }

    private byte[] generateMarkdown(Document doc) {
        StringBuilder sb = new StringBuilder();
        sb.append("# ").append(doc.getTitle()).append("\n\n");
        if (doc.getContent() != null) {
            sb.append(doc.getContent()).append("\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private byte[] generatePlainText(Document doc) {
        StringBuilder sb = new StringBuilder();
        sb.append(doc.getTitle().toUpperCase()).append("\n");
        sb.append("=".repeat(Math.max(doc.getTitle().length(), 10))).append("\n\n");
        if (doc.getContent() != null) {
            // Strip simple markdown tags
            String text = doc.getContent()
                    .replaceAll("#+\\s*", "")
                    .replaceAll("\\*\\*(.*?)\\*\\*", "$1")
                    .replaceAll("\\*(.*?)\\*", "$1")
                    .replaceAll("`{1,3}(.*?)`{1,3}", "$1")
                    .replaceAll("\\[(.*?)\\]\\(.*?\\)", "$1");
            sb.append(text).append("\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private byte[] generateHtml(Document doc) {
        String title = escapeHtml(doc.getTitle());
        String rawContent = doc.getContent() != null ? doc.getContent() : "";
        // Content is stored as rich HTML from the editor (docPageSheet.innerHTML).
        // Preserve it directly with sanitization; fallback to markdown conversion only if plain text.
        String body;
        if (rawContent.contains("<") && rawContent.contains(">")) {
            // Assume HTML — sanitize scripts but preserve styling
            body = sanitizeHtmlForExport(rawContent);
        } else {
            body = convertMarkdownToHtml(rawContent);
        }

        String html = "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "  <meta charset=\"UTF-8\">\n" +
                "  <title>" + title + " - SyncPad</title>\n" +
                "  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n" +
                "  <link href=\"https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap\" rel=\"stylesheet\">\n" +
                "  <link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css\">\n" +
                "  <style>\n" +
                "    @page { size: letter; margin: 18mm; }\n" +
                "    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }\n" +
                "    html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11pt; line-height: 1.65; }\n" +
                "    body { padding: 16mm 18mm; }\n" +
                "    .document-card { background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; max-width: 816px; margin: 0 auto; }\n" +
                "    h1 { font-size: 2rem; font-weight: 700; line-height: 1.3; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin: 1.25rem 0 0.75rem 0; color: #0f172a; } h1:first-child{margin-top:0;}\n" +
                "    h2 { font-size: 1.5rem; font-weight: 600; line-height: 1.35; margin: 1.2rem 0 0.5rem 0; }\n" +
                "    h3 { font-size: 1.2rem; font-weight: 600; line-height: 1.4; margin: 1rem 0 0.4rem 0; }\n" +
                "    p { margin: 0 0 0.85rem 0; line-height: 1.65; }\n" +
                "    a { color: #2563eb; text-decoration: underline; }\n" +
                "    code { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.88em; background: #f1f5f9; padding: 1.5px 4px; border-radius: 3px; border: 1px solid #e2e8f0; }\n" +
                "    pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; } pre code { background: transparent; border: none; }\n" +
                "    blockquote { border-left: 3.5px solid #7c3aed; background: #f8fafc; color: #475569; font-style: italic; margin: 1.25rem 0; padding: 0.65rem 1rem; border-radius: 0 4px 4px 0; }\n" +
                "    .doc-callout { border-left: 4px solid #2563eb; background: #eff6ff; border-radius: 0 6px 6px 0; padding: 0.85rem 1.15rem; margin: 1rem 0; }\n" +
                "    .doc-code-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden; margin: 1.25rem 0; } .doc-code-header { display:flex; justify-content:space-between; background:#1e293b; color:#94a3b8; padding:0.5rem 0.85rem; font-size:0.75rem; } .doc-code-content { padding:0.85rem 1rem; } .doc-code-content pre { margin:0; }\n" +
                "    .doc-latex-card { text-align:center; margin: 1.25rem 0; position: relative; }\n    .doc-latex-card.is-floating { position: absolute !important; margin: 0 !important; z-index: 10 !important; }\n    .doc-content { position: relative; }\n" +
                "    .doc-checklist { list-style:none; padding-left:0; } .doc-checklist-item { padding-left:28px; position:relative; }\n" +
                "    table.doc-table { width:100%; border-collapse:collapse; margin:1.25rem 0; } table.doc-table th, table.doc-table td, table th, table td { border:1px solid #cbd5e1; padding:0.6rem 0.85rem; text-align:left; } table.doc-table th, table th { background:#f8fafc; font-weight:600; }\n" +
                "    img { max-width:100%; height:auto; border-radius:6px; border:1px solid #cbd5e1; }\n" +
                "    hr { border:none; border-top:1px solid #e2e8f0; margin:1.5rem 0; }\n" +
                "    .footer { margin-top: 40px; font-size: 0.85em; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; }\n" +
                "  </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "  <div class=\"document-card\">\n" +
                "    <h1>" + title + "</h1>\n" +
                "    <div class=\"doc-content\">" + body + "</div>\n" +
                "    <div class=\"footer\">\n" +
                "      Exported from SyncPad &bull; " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) + "\n" +
                "    </div>\n" +
                "  </div>\n" +
                "</body>\n" +
                "</html>";

        return html.getBytes(StandardCharsets.UTF_8);
    }

    private String sanitizeHtmlForExport(String html) {
        if (html == null) return "";
        // Remove script/style injection, keep all formatting
        String sanitized = html.replaceAll("(?i)<script[^>]*>[\\s\\S]*?</script>", "")
                               .replaceAll("(?i) on\\w+\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]*)", "")
                               .replaceAll("(?i)contenteditable=\"[^\"]*\"", "")
                               .replaceAll("(?i)spellcheck=\"[^\"]*\"", "");
        // Remove editor-only transient UI
        sanitized = sanitized.replaceAll("(?i)<div class=\"latex-hover[^>]*>[\\s\\S]*?</div>", "")
                             .replaceAll("(?i)<span class=\"comment-anchor[^>]*>.*?</span>", "")
                             .replaceAll("(?i)class=\"[^\"]*latex-placeholder[^\"]*\"[^>]*>.*?</[^>]+>", "");
        return sanitized;
    }

    private byte[] generateJson(Document doc) {
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", doc.getId());
            map.put("title", doc.getTitle());
            map.put("content", doc.getContent());
            map.put("fileType", doc.getFileType() != null ? doc.getFileType().name() : "DOC");
            map.put("workspaceName", doc.getWorkspaceName());
            map.put("folderId", doc.getFolder() != null ? doc.getFolder().getId() : null);
            map.put("ownerId", doc.getOwner() != null ? doc.getOwner().getId() : null);
            map.put("ownerEmail", doc.getOwner() != null ? doc.getOwner().getEmail() : null);
            map.put("version", doc.getVersion());
            map.put("pdfFileName", doc.getPdfFileName());
            map.put("pdfUrl", doc.getPdfUrl());
            map.put("createdAt", doc.getCreatedAt());
            map.put("updatedAt", doc.getUpdatedAt());
            map.put("commentCount", commentRepository.countByDocument(doc));

            return objectMapper.writeValueAsBytes(map);
        } catch (Exception e) {
            log.error("Failed to generate JSON export for doc {}: {}", doc.getId(), e.getMessage());
            return "{}".getBytes(StandardCharsets.UTF_8);
        }
    }

    private byte[] generatePdf(Document doc) {
        String title = doc.getTitle() != null ? doc.getTitle() : "Untitled";
        String htmlContent = doc.getContent() != null ? doc.getContent() : "";
        // Strip HTML to plain text but preserve structure for PDF
        String plain = htmlToPlainText(htmlContent);
        String fullText = title + "\n\n" + plain;
        return createMinimalPdf(title, fullText);
    }

    private String htmlToPlainText(String html) {
        if (html == null) return "";
        String text = html;
        // Preserve block structure as newlines
        text = text.replaceAll("(?i)</(h[1-6]|p|div|blockquote|pre|li|tr|table|ul|ol)>", "\n");
        text = text.replaceAll("(?i)<br[^>]*>", "\n");
        text = text.replaceAll("(?i)<li[^>]*>", "• ");
        // Strip all remaining tags
        text = text.replaceAll("<[^>]+>", "");
        // Unescape HTML entities
        text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                   .replace("&quot;", "\"").replace("&#39;", "'").replace("&#039;", "'");
        // Collapse excessive whitespace but keep paragraph breaks
        text = text.replaceAll("[ \\t]+", " ");
        text = text.replaceAll("\n +", "\n");
        text = text.replaceAll("\n{3,}", "\n\n");
        return text.trim();
    }

    private byte[] generateZipBundle(Document doc, String baseName) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zos = new ZipOutputStream(baos, StandardCharsets.UTF_8)) {

            // 1. Markdown
            zos.putNextEntry(new ZipEntry(baseName + ".md"));
            zos.write(generateMarkdown(doc));
            zos.closeEntry();

            // 2. HTML
            zos.putNextEntry(new ZipEntry(baseName + ".html"));
            zos.write(generateHtml(doc));
            zos.closeEntry();

            // 3. Plain Text
            zos.putNextEntry(new ZipEntry(baseName + ".txt"));
            zos.write(generatePlainText(doc));
            zos.closeEntry();

            // 4. JSON metadata
            zos.putNextEntry(new ZipEntry(baseName + ".json"));
            zos.write(generateJson(doc));
            zos.closeEntry();

            zos.finish();
            return baos.toByteArray();
        } catch (IOException e) {
            log.error("Failed to generate ZIP export for doc {}: {}", doc.getId(), e.getMessage());
            return new byte[0];
        }
    }

    private byte[] createMinimalPdf(String title, String content) {
        // High-fidelity text PDF with word-wrapping, pagination, and correct xref
        if (title == null) title = "Untitled";
        if (content == null) content = "";
        // Normalize and handle full content without truncation
        String sanitized = content.replace("\r", "");
        // Split into lines and wrap at 90 chars for 612pt width (Helvetica 11pt ~ 6pt per char)
        java.util.List<String> pdfLines = new java.util.ArrayList<>();
        pdfLines.add(title);
        pdfLines.add(""); // blank line after title
        for (String para : sanitized.split("\n")) {
            if (para.trim().isEmpty()) {
                pdfLines.add("");
                continue;
            }
            // Word wrap
            String[] words = para.split("\\s+");
            StringBuilder line = new StringBuilder();
            for (String w : words) {
                if (line.length() + w.length() + 1 > 90) {
                    pdfLines.add(line.toString());
                    line = new StringBuilder(w);
                } else {
                    if (line.length() > 0) line.append(" ");
                    line.append(w);
                }
            }
            if (line.length() > 0) pdfLines.add(line.toString());
        }

        // Pagination: 45 lines per page (792pt height - margins, 15pt line height)
        int linesPerPage = 45;
        int totalPages = Math.max(1, (int) Math.ceil((double) pdfLines.size() / linesPerPage));
        java.util.List<byte[]> pageStreams = new java.util.ArrayList<>();
        java.util.List<Integer> pageStreamLengths = new java.util.ArrayList<>();

        for (int pg = 0; pg < totalPages; pg++) {
            int start = pg * linesPerPage;
            int end = Math.min(start + linesPerPage, pdfLines.size());
            java.util.List<String> pageLines = pdfLines.subList(start, end);
            StringBuilder stream = new StringBuilder();
            if (pg == 0) {
                // Title on first page
                stream.append("BT /F1 16 Tf 50 750 Td (").append(escapePdfText(title)).append(") Tj ET\n");
                stream.append("BT /F1 11 Tf 50 720 Td 14 TL\n");
                // Skip title lines already added, start from line 2
                for (int i = 2; i < pageLines.size(); i++) {
                    String l = pageLines.get(i);
                    if (l.isEmpty()) stream.append("T*\n");
                    else stream.append("(").append(escapePdfText(l)).append(") '\n");
                }
                stream.append("ET\n");
            } else {
                stream.append("BT /F1 11 Tf 50 750 Td 14 TL\n");
                for (String l : pageLines) {
                    if (l.isEmpty()) stream.append("T*\n");
                    else stream.append("(").append(escapePdfText(l)).append(") '\n");
                }
                stream.append("ET\n");
            }
            byte[] bytes = stream.toString().getBytes(StandardCharsets.ISO_8859_1);
            pageStreams.add(bytes);
            pageStreamLengths.add(bytes.length);
        }

        // Build PDF with dynamic xref
        StringBuilder sb = new StringBuilder();
        java.util.List<Integer> offsets = new java.util.ArrayList<>();
        offsets.add(0); // object 0
        java.util.function.Consumer<String> addStr = s -> sb.append(s);
        // We need byte-accurate offsets, so track via bytes
        java.nio.charset.Charset iso = StandardCharsets.ISO_8859_1;
        StringBuilder header = new StringBuilder();
        header.append("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n");
        byte[] headerBytes = header.toString().getBytes(iso);
        // Use ByteArrayOutputStream for accurate offsets
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            baos.write(headerBytes);
            java.util.List<Integer> objOffsets = new java.util.ArrayList<>();
            objOffsets.add(0);
            // Objects: 1 Catalog, 2 Pages, then for each page: Page, Contents, plus 1 Font
            // Reserve object numbers: 1 Catalog, 2 Pages, 3..(2+totalPages*2) pages/contents, last Font
            int objCount = 2 + totalPages * 2 + 1;
            // Catalog
            objOffsets.add(baos.size());
            String cat = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
            baos.write(cat.getBytes(iso));
            // Pages
            objOffsets.add(baos.size());
            StringBuilder kids = new StringBuilder();
            for (int i = 0; i < totalPages; i++) {
                int pageObjNum = 3 + i * 2;
                kids.append(pageObjNum).append(" 0 R ");
            }
            String pages = "2 0 obj\n<< /Type /Pages /Kids [" + kids.toString().trim() + "] /Count " + totalPages + " >>\nendobj\n";
            baos.write(pages.getBytes(iso));
            // Page and Content objects
            for (int i = 0; i < totalPages; i++) {
                int pageObjNum = 3 + i * 2;
                int contentObjNum = 4 + i * 2;
                byte[] streamBytes = pageStreams.get(i);
                // Page object
                objOffsets.add(baos.size()); // pageObjNum
                // Ensure list size
                while (objOffsets.size() <= pageObjNum) objOffsets.add(0);
                // Actually we need to place correctly: objOffsets index = objNum
                // We'll rebuild list properly
            }
            // Simpler: rebuild with correct ordering using loop and tracking
            baos = new ByteArrayOutputStream();
            baos.write(headerBytes);
            java.util.List<Integer> offsetsList = new java.util.ArrayList<>();
            offsetsList.add(0); // 0
            // 1 Catalog
            offsetsList.add(baos.size());
            baos.write("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".getBytes(iso));
            // 2 Pages
            offsetsList.add(baos.size());
            StringBuilder kids2 = new StringBuilder();
            for (int i = 0; i < totalPages; i++) kids2.append((3 + i*2)).append(" 0 R ");
            baos.write(("2 0 obj\n<< /Type /Pages /Kids [" + kids2.toString().trim() + "] /Count " + totalPages + " >>\nendobj\n").getBytes(iso));
            // Pages and contents
            for (int i = 0; i < totalPages; i++) {
                int pageNum = 3 + i*2;
                int contentNum = 4 + i*2;
                // Ensure offsetsList size
                while (offsetsList.size() <= contentNum) offsetsList.add(0);
                offsetsList.set(pageNum, baos.size());
                String pageObj = pageNum + " 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents " + contentNum + " 0 R /Resources << /Font << /F1 " + (3 + totalPages*2) + " 0 R >> >> >>\nendobj\n";
                baos.write(pageObj.getBytes(iso));
                offsetsList.set(contentNum, baos.size());
                String contentObj = contentNum + " 0 obj\n<< /Length " + pageStreamLengths.get(i) + " >>\nstream\n";
                baos.write(contentObj.getBytes(iso));
                baos.write(pageStreams.get(i));
                baos.write("\nendstream\nendobj\n".getBytes(iso));
            }
            int fontNum = 3 + totalPages*2;
            while (offsetsList.size() <= fontNum) offsetsList.add(0);
            offsetsList.set(fontNum, baos.size());
            baos.write((fontNum + " 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n").getBytes(iso));
            int xrefOffset = baos.size();
            StringBuilder xref = new StringBuilder();
            xref.append("xref\n0 ").append(fontNum + 1).append("\n");
            xref.append(String.format("%010d %05d f \n", 0, 65535));
            for (int i = 1; i <= fontNum; i++) {
                int off = offsetsList.get(i) != null ? offsetsList.get(i) : 0;
                xref.append(String.format("%010d 00000 n \n", off));
            }
            baos.write(xref.toString().getBytes(iso));
            String trailer = "trailer\n<< /Size " + (fontNum + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF\n";
            baos.write(trailer.getBytes(iso));
            return baos.toByteArray();
        } catch (IOException e) {
            log.error("Failed to build PDF", e);
            return new byte[0];
        }
    }

    private String escapePdfText(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                .replace("(", "\\(")
                .replace(")", "\\)")
                .replaceAll("[\\r\\n]+", " ");
    }

    private String truncate(String text, int max) {
        if (text == null || text.length() <= max) return text;
        return text.substring(0, max) + "...";
    }

    private String sanitizeFilename(String title) {
        if (title == null || title.isBlank()) return "untitled_document";
        return title.trim().replaceAll("[\\\\/:*?\"<>|\\s]+", "_");
    }

    private String urlEncode(String value) {
        try {
            return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8.name()).replace("+", "%20");
        } catch (Exception e) {
            return value;
        }
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String convertMarkdownToHtml(String markdown) {
        if (markdown == null || markdown.isBlank()) return "";
        StringBuilder sb = new StringBuilder();
        for (String line : markdown.split("\n")) {
            if (line.startsWith("### ")) {
                sb.append("<h3>").append(escapeHtml(line.substring(4))).append("</h3>\n");
            } else if (line.startsWith("## ")) {
                sb.append("<h2>").append(escapeHtml(line.substring(3))).append("</h2>\n");
            } else if (line.startsWith("# ")) {
                sb.append("<h1>").append(escapeHtml(line.substring(2))).append("</h1>\n");
            } else if (line.startsWith("- ") || line.startsWith("* ")) {
                sb.append("<li>").append(escapeHtml(line.substring(2))).append("</li>\n");
            } else if (line.isBlank()) {
                sb.append("<br/>\n");
            } else {
                sb.append("<p>").append(escapeHtml(line)).append("</p>\n");
            }
        }
        return sb.toString();
    }
}
