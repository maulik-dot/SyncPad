package com.example.syncpad.crdt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class CrdtDocumentEngineTest {

    @Test
    void sequentialTyping_buildsCorrectString() {
        CrdtDocumentEngine engine = new CrdtDocumentEngine(1L);

        CrdtId id1 = new CrdtId("alice", 1);
        engine.applyInsert(id1, null, null, "H");

        CrdtId id2 = new CrdtId("alice", 2);
        engine.applyInsert(id2, id1, null, "i");

        assertEquals("Hi", engine.toText());
        assertEquals(2, engine.size());
    }

    @Test
    void concurrentInsertionAtSamePosition_convergesDeterministically() {
        // Two independent replicas of document 100
        CrdtDocumentEngine replicaAlice = new CrdtDocumentEngine(100L);
        CrdtDocumentEngine replicaBob = new CrdtDocumentEngine(100L);

        // Initial shared state: "A"
        CrdtId rootId = new CrdtId("system", 1);
        replicaAlice.applyInsert(rootId, null, null, "A");
        replicaBob.applyInsert(rootId, null, null, "A");

        // Alice types "X" after "A"
        CrdtId aliceId = new CrdtId("alice", 2);
        CrdtOperation aliceOp = CrdtOperation.insert(100L, aliceId, rootId, null, "X", "alice@syncpad.com");

        // Bob simultaneously types "Y" after "A"
        CrdtId bobId = new CrdtId("bob", 2);
        CrdtOperation bobOp = CrdtOperation.insert(100L, bobId, rootId, null, "Y", "bob@syncpad.com");

        // Alice applies her own edit first, then receives Bob's edit
        replicaAlice.applyOperation(aliceOp);
        replicaAlice.applyOperation(bobOp);

        // Bob applies his own edit first, then receives Alice's edit
        replicaBob.applyOperation(bobOp);
        replicaBob.applyOperation(aliceOp);

        // Crucial CRDT assertion: Both replicas MUST converge to the exact same text!
        String textAlice = replicaAlice.toText();
        String textBob = replicaBob.toText();

        assertEquals(textAlice, textBob, "Replicas failed to converge under concurrent edits!");
        assertEquals(3, replicaAlice.size());
    }

    @Test
    void characterDeletion_tombstonesAndPreservesCoordinates() {
        CrdtDocumentEngine engine = new CrdtDocumentEngine(1L);

        CrdtId idA = new CrdtId("node1", 1);
        CrdtId idB = new CrdtId("node1", 2);
        CrdtId idC = new CrdtId("node1", 3);

        engine.applyInsert(idA, null, null, "A");
        engine.applyInsert(idB, idA, null, "B");
        engine.applyInsert(idC, idB, null, "C");
        assertEquals("ABC", engine.toText());

        // Delete 'B'
        boolean deleted = engine.applyDelete(idB);
        assertTrue(deleted);
        assertEquals("AC", engine.toText());
        assertEquals(2, engine.size());

        // Concurrent user inserts 'X' anchored to deleted 'B' with Lamport clock 4
        CrdtId idX = new CrdtId("node2", 4);
        engine.applyInsert(idX, idB, null, "X");

        // 'X' is positioned right after where 'B' was (before 'C' since clock 4 > clock 3)
        assertEquals("AXC", engine.toText());
    }

    @Test
    void idempotentOperations_doNotDuplicateOrCorruptState() {
        CrdtDocumentEngine engine = new CrdtDocumentEngine(1L);

        CrdtId id = new CrdtId("node1", 1);
        assertTrue(engine.applyInsert(id, null, null, "Z"));
        assertFalse(engine.applyInsert(id, null, null, "Z")); // Duplicate insert ignored

        assertEquals("Z", engine.toText());

        assertTrue(engine.applyDelete(id));
        assertFalse(engine.applyDelete(id)); // Duplicate delete is idempotent

        assertEquals("", engine.toText());
    }

    @Test
    void loadFromText_initializesExistingDocument() {
        CrdtDocumentEngine engine = new CrdtDocumentEngine(1L);
        engine.loadFromText("SyncPad Real-Time", "system");

        assertEquals("SyncPad Real-Time", engine.toText());
        assertEquals(17, engine.size());
    }
}
