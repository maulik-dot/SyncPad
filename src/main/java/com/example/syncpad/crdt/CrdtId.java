package com.example.syncpad.crdt;

import java.io.Serializable;
import java.util.Objects;

public record CrdtId(String siteId, long clock) implements Comparable<CrdtId>, Serializable {

    public CrdtId {
        Objects.requireNonNull(siteId, "siteId must not be null");
    }

    @Override
    public int compareTo(CrdtId other) {
        if (other == null) return 1;
        if (this.clock != other.clock) {
            return Long.compare(this.clock, other.clock);
        }
        return this.siteId.compareTo(other.siteId);
    }

    @Override
    public String toString() {
        return siteId + "@" + clock;
    }
}

