package com.example.syncpad.crdt;

import java.io.Serializable;
import java.util.Objects;

public class CrdtCharacter implements Serializable {
    private final CrdtId id;
    private final CrdtId leftOriginId;
    private final CrdtId rightOriginId;
    private final String value;
    private boolean deleted;

    public CrdtCharacter(CrdtId id, CrdtId leftOriginId, CrdtId rightOriginId, String value) {
        this.id = Objects.requireNonNull(id, "id must not be null");
        this.leftOriginId = leftOriginId;
        this.rightOriginId = rightOriginId;
        this.value = value != null ? value : "";
        this.deleted = false;
    }

    public CrdtId getId() {
        return id;
    }

    public CrdtId getLeftOriginId() {
        return leftOriginId;
    }

    public CrdtId getRightOriginId() {
        return rightOriginId;
    }

    public String getValue() {
        return value;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CrdtCharacter that = (CrdtCharacter) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "CrdtCharacter{" +
                "id=" + id +
                ", val='" + value + '\'' +
                ", deleted=" + deleted +
                '}';
    }
}

