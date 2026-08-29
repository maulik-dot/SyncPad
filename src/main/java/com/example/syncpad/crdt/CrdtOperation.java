package com.example.syncpad.crdt;

import java.io.Serializable;

public class CrdtOperation implements Serializable {

    public enum Type {
        INSERT,
        DELETE,
        SYNC_REQUEST,
        SYNC_RESPONSE
    }

    private Long documentId;
    private Type type;
    private CrdtId id;
    private CrdtId leftOriginId;
    private CrdtId rightOriginId;
    private String value;
    private String senderEmail;
    private long timestamp;

    public CrdtOperation() {
        this.timestamp = System.currentTimeMillis();
    }

    public static CrdtOperation insert(Long documentId, CrdtId id, CrdtId leftOriginId, CrdtId rightOriginId, String value, String senderEmail) {
        CrdtOperation op = new CrdtOperation();
        op.setDocumentId(documentId);
        op.setType(Type.INSERT);
        op.setId(id);
        op.setLeftOriginId(leftOriginId);
        op.setRightOriginId(rightOriginId);
        op.setValue(value);
        op.setSenderEmail(senderEmail);
        return op;
    }

    public static CrdtOperation delete(Long documentId, CrdtId id, String senderEmail) {
        CrdtOperation op = new CrdtOperation();
        op.setDocumentId(documentId);
        op.setType(Type.DELETE);
        op.setId(id);
        op.setSenderEmail(senderEmail);
        return op;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public Type getType() {
        return type;
    }

    public void setType(Type type) {
        this.type = type;
    }

    public CrdtId getId() {
        return id;
    }

    public void setId(CrdtId id) {
        this.id = id;
    }

    public CrdtId getLeftOriginId() {
        return leftOriginId;
    }

    public void setLeftOriginId(CrdtId leftOriginId) {
        this.leftOriginId = leftOriginId;
    }

    public CrdtId getRightOriginId() {
        return rightOriginId;
    }

    public void setRightOriginId(CrdtId rightOriginId) {
        this.rightOriginId = rightOriginId;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public String getSenderEmail() {
        return senderEmail;
    }

    public void setSenderEmail(String senderEmail) {
        this.senderEmail = senderEmail;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}

