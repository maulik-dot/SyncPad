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
        String body = convertMarkdownToHtml(doc.getContent() != null ? doc.getContent() : "");

        String html = "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "  <meta charset=\"UTF-8\">\n" +
                "  <title>" + title + " - SyncPad</title>\n" +
                "  <style>\n" +
                "    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; background: #f8fafc; }\n" +
                "    .document-card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }\n" +
                "    h1 { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-top: 0; color: #0f172a; }\n" +
                "    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: monospace; }\n" +
                "    pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; }\n" +
                "    blockquote { border-left: 4px solid #6366f1; margin: 0; padding-left: 16px; color: #475569; }\n" +
                "    .footer { margin-top: 40px; font-size: 0.85em; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }\n" +
                "  </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "  <div class=\"document-card\">\n" +
                "    <h1>" + title + "</h1>\n" +
                "    " + body + "\n" +
                "    <div class=\"footer\">\n" +
                "      Exported from SyncPad &bull; " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) + "\n" +
                "    </div>\n" +
                "  </div>\n" +
                "</body>\n" +
                "</html>";

        return html.getBytes(StandardCharsets.UTF_8);
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
        // Minimal standard valid PDF stream containing document text
        String text = doc.getTitle() + "\n\n" + (doc.getContent() != null ? doc.getContent() : "");
        return createMinimalPdf(doc.getTitle(), text);
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
        StringBuilder sb = new StringBuilder();
        sb.append("%PDF-1.4\n");
        sb.append("1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n");
        sb.append("2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n");
        sb.append("3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n");

        String sanitizedText = content.replace("(", "\\(").replace(")", "\\)").replace("\r", "");
        String streamContent = "BT /F1 16 Tf 50 720 Td (" + escapePdfText(title) + ") Tj ET\n" +
                "BT /F1 11 Tf 50 690 Td 15 TL (" + escapePdfText(truncate(sanitizedText, 500)) + ") ' ET";
        int streamLen = streamContent.getBytes(StandardCharsets.ISO_8859_1).length;

        sb.append("4 0 obj <</Length ").append(streamLen).append(">> stream\n");
        sb.append(streamContent).append("\nendstream\nendobj\n");
        sb.append("5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n");
        sb.append("xref\n0 6\n0000000000 65535 f \n");
        sb.append("0000000010 00000 n \n0000000057 00000 n \n0000000115 00000 n \n");
        sb.append("trailer <</Size 6 /Root 1 0 R>>\nstartxref\n380\n%%EOF\n");

        return sb.toString().getBytes(StandardCharsets.ISO_8859_1);
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
