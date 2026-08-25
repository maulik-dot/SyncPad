package com.example.syncpad.dto.message;

public class DocumentEditMessage {
    private Long documentId;
    private String title;
    private String content;
    private String senderEmail;
    private String senderName;
    private String type; // "EDIT", "PRESENCE", "CURSOR", "SAVED", "COMMENT"
    private Integer cursorPosition;
    private Integer selectionStart;
    private Integer selectionEnd;
    private Double cursorX;
    private Double cursorY;
    private Integer cursorHeight;
    private long timestamp;

    public DocumentEditMessage() {
    }

    public DocumentEditMessage(Long documentId, String title, String content, String senderEmail, String senderName, String type) {
        this.documentId = documentId;
        this.title = title;
        this.content = content;
        this.senderEmail = senderEmail;
        this.senderName = senderName;
        this.type = type;
        this.timestamp = System.currentTimeMillis();
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getSenderEmail() {
        return senderEmail;
    }

    public void setSenderEmail(String senderEmail) {
        this.senderEmail = senderEmail;
    }

    public String getSenderName() {
        return senderName;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Integer getCursorPosition() {
        return cursorPosition;
    }

    public void setCursorPosition(Integer cursorPosition) {
        this.cursorPosition = cursorPosition;
    }

    public Integer getSelectionStart() {
        return selectionStart;
    }

    public void setSelectionStart(Integer selectionStart) {
        this.selectionStart = selectionStart;
    }

    public Integer getSelectionEnd() {
        return selectionEnd;
    }

    public void setSelectionEnd(Integer selectionEnd) {
        this.selectionEnd = selectionEnd;
    }

    public Double getCursorX() {
        return cursorX;
    }

    public void setCursorX(Double cursorX) {
        this.cursorX = cursorX;
    }

    public Double getCursorY() {
        return cursorY;
    }

    public void setCursorY(Double cursorY) {
        this.cursorY = cursorY;
    }

    public Integer getCursorHeight() {
        return cursorHeight;
    }

    public void setCursorHeight(Integer cursorHeight) {
        this.cursorHeight = cursorHeight;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}
