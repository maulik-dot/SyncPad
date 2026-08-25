package com.example.syncpad.dto.request;

import jakarta.validation.constraints.NotBlank;

public class AttachPdfRequest {

    @NotBlank(message = "PDF file name is required")
    private String fileName;

    private String pdfUrl;

    public AttachPdfRequest() {}

    public AttachPdfRequest(String fileName, String pdfUrl) {
        this.fileName = fileName;
        this.pdfUrl = pdfUrl;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getPdfUrl() {
        return pdfUrl;
    }

    public void setPdfUrl(String pdfUrl) {
        this.pdfUrl = pdfUrl;
    }
}
