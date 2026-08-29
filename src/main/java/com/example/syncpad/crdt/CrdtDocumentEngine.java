package com.example.syncpad.crdt;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * High-performance Character-Level Conflict-Free Replicated Data Type (CRDT) Engine
 * based on Replicated Growable Array (RGA) deterministic convergence semantics.
 */
public class CrdtDocumentEngine {

    private static final Logger log = LoggerFactory.getLogger(CrdtDocumentEngine.class);

    private final Long documentId;
    private final List<CrdtCharacter> characters = new ArrayList<>();
    private final Map<CrdtId, CrdtCharacter> characterMap = new HashMap<>();
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();

    public CrdtDocumentEngine(Long documentId) {
        this.documentId = documentId;
    }

    public Long getDocumentId() {
        return documentId;
    }

    /**
     * Applies a CRDT operation (INSERT or DELETE) in a thread-safe, commutative manner.
     */
    public boolean applyOperation(CrdtOperation op) {
        if (op == null || op.getType() == null) return false;

        rwLock.writeLock().lock();
        try {
            if (op.getType() == CrdtOperation.Type.INSERT) {
                return applyInsert(op.getId(), op.getLeftOriginId(), op.getRightOriginId(), op.getValue());
            } else if (op.getType() == CrdtOperation.Type.DELETE) {
                return applyDelete(op.getId());
            }
            return false;
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    /**
     * Inserts a character into the CRDT sequence using deterministic RGA conflict resolution.
     */
    public boolean applyInsert(CrdtId id, CrdtId leftOriginId, CrdtId rightOriginId, String value) {
        if (id == null) return false;

        // Idempotency: if already present, do nothing
        if (characterMap.containsKey(id)) {
            return false;
        }

        CrdtCharacter newChar = new CrdtCharacter(id, leftOriginId, rightOriginId, value);

        int leftIndex = -1;
        if (leftOriginId != null) {
            CrdtCharacter leftChar = characterMap.get(leftOriginId);
            if (leftChar != null) {
                leftIndex = characters.indexOf(leftChar);
            }
        }

        int insertIndex = leftIndex + 1;
        while (insertIndex < characters.size()) {
            CrdtCharacter curr = characters.get(insertIndex);
            int currLeftIndex = -1;
            if (curr.getLeftOriginId() != null) {
                CrdtCharacter currLeft = characterMap.get(curr.getLeftOriginId());
                if (currLeft != null) {
                    currLeftIndex = characters.indexOf(currLeft);
                }
            }

            if (currLeftIndex < leftIndex) {
                break;
            } else if (currLeftIndex == leftIndex) {
                // Concurrent insertion at the same relative position. Tie-break deterministically.
                if (newChar.getId().compareTo(curr.getId()) > 0) {
                    break;
                } else {
                    insertIndex++;
                }
            } else {
                insertIndex++;
            }
        }

        characters.add(insertIndex, newChar);
        characterMap.put(id, newChar);
        log.trace("CRDT Inserted {} at index {} (docId={})", newChar, insertIndex, documentId);
        return true;
    }

    /**
     * Marks a character as deleted (tombstone) idempotently.
     */
    public boolean applyDelete(CrdtId id) {
        if (id == null) return false;

        CrdtCharacter character = characterMap.get(id);
        if (character != null && !character.isDeleted()) {
            character.setDeleted(true);
            log.trace("CRDT Deleted character {} (docId={})", id, documentId);
            return true;
        }
        return false;
    }

    /**
     * Materializes non-deleted characters into current text/HTML string.
     */
    public String toText() {
        rwLock.readLock().lock();
        try {
            StringBuilder sb = new StringBuilder();
            for (CrdtCharacter c : characters) {
                if (!c.isDeleted()) {
                    sb.append(c.getValue());
                }
            }
            return sb.toString();
        } finally {
            rwLock.readLock().unlock();
        }
    }

    /**
     * Initializes CRDT sequence from existing snapshot content.
     */
    public void loadFromText(String content, String siteId) {
        if (content == null) content = "";
        rwLock.writeLock().lock();
        try {
            characters.clear();
            characterMap.clear();

            CrdtId prevId = null;
            long clock = 1;
            for (int i = 0; i < content.length(); i++) {
                String val = String.valueOf(content.charAt(i));
                CrdtId currentId = new CrdtId(siteId, clock++);
                CrdtCharacter c = new CrdtCharacter(currentId, prevId, null, val);
                characters.add(c);
                characterMap.put(currentId, c);
                prevId = currentId;
            }
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    public int size() {
        rwLock.readLock().lock();
        try {
            return (int) characters.stream().filter(c -> !c.isDeleted()).count();
        } finally {
            rwLock.readLock().unlock();
        }
    }

    public List<CrdtCharacter> getCharacters() {
        rwLock.readLock().lock();
        try {
            return Collections.unmodifiableList(new ArrayList<>(characters));
        } finally {
            rwLock.readLock().unlock();
        }
    }
}

