/**
 * SyncPad Character-Level Conflict-Free Replicated Data Type (CRDT) Engine
 * Implements Replicated Growable Array (RGA) deterministic convergence semantics in browser.
 */

(function () {
    'use strict';

    class CrdtId {
        constructor(siteId, clock) {
            this.siteId = siteId;
            this.clock = clock;
        }

        compareTo(other) {
            if (!other) return 1;
            if (this.clock !== other.clock) {
                return this.clock - other.clock;
            }
            return this.siteId.localeCompare(other.siteId);
        }

        toString() {
            return `${this.siteId}@${this.clock}`;
        }
    }

    class CrdtCharacter {
        constructor(id, leftOriginId, rightOriginId, value) {
            this.id = id;
            this.leftOriginId = leftOriginId;
            this.rightOriginId = rightOriginId;
            this.value = value || '';
            this.deleted = false;
        }
    }

    class SyncPadCrdtEngine {
        constructor() {
            this.documentId = null;
            this.siteId = 'client_' + Math.random().toString(36).substring(2, 9);
            this.clock = 0;
            this.characters = [];
            this.characterMap = new Map();
            this.isApplyingRemote = false;
        }

        init(docId, initialContent, siteId) {
            this.documentId = docId;
            if (siteId) this.siteId = siteId;
            this.clock = 0;
            this.characters = [];
            this.characterMap.clear();

            if (initialContent) {
                let prevId = null;
                for (let i = 0; i < initialContent.length; i++) {
                    const charVal = initialContent.charAt(i);
                    const id = new CrdtId('seed', ++this.clock);
                    const c = new CrdtCharacter(id, prevId, null, charVal);
                    this.characters.push(c);
                    this.characterMap.set(id.toString(), c);
                    prevId = id;
                }
            }
            console.log(`[CRDT] Initialized document ${docId} with ${this.characters.length} characters.`);
        }

        /**
         * Synchronizes local CRDT state from new text/HTML content by computing the diff
         * and generating corresponding INSERT and DELETE CRDT operations.
         * @param {string} newText The updated full text/HTML.
         * @param {string} senderEmail The current user's email.
         * @returns {Array<Object>} List of generated CRDT operation objects.
         */
        syncFromText(newText, senderEmail) {
            if (newText === null || newText === undefined) return [];
            const oldText = this.toText();
            if (newText === oldText) return [];

            if (this.characters.length === 0 && oldText.length === 0) {
                const ops = [];
                for (let i = 0; i < newText.length; i++) {
                    ops.push(this.localInsert(i, newText.charAt(i), senderEmail));
                }
                return ops;
            }

            let prefixLen = 0;
            const minLen = Math.min(oldText.length, newText.length);
            while (prefixLen < minLen && oldText.charCodeAt(prefixLen) === newText.charCodeAt(prefixLen)) {
                prefixLen++;
            }

            let oldSuffix = oldText.length - 1;
            let newSuffix = newText.length - 1;
            while (oldSuffix >= prefixLen && newSuffix >= prefixLen && oldText.charCodeAt(oldSuffix) === newText.charCodeAt(newSuffix)) {
                oldSuffix--;
                newSuffix--;
            }

            const ops = [];
            const deleteCount = oldSuffix - prefixLen + 1;
            for (let i = 0; i < deleteCount; i++) {
                const delOp = this.localDelete(prefixLen, senderEmail);
                if (delOp) ops.push(delOp);
            }

            const insertCount = newSuffix - prefixLen + 1;
            for (let i = 0; i < insertCount; i++) {
                const charVal = newText.charAt(prefixLen + i);
                const insOp = this.localInsert(prefixLen + i, charVal, senderEmail);
                if (insOp) ops.push(insOp);
            }

            return ops;
        }

        /**
         * Generates a local INSERT operation
         */
        localInsert(visibleIndex, charValue, senderEmail) {
            const active = this.getActiveCharacters();
            let leftOriginId = null;

            if (visibleIndex > 0 && visibleIndex <= active.length) {
                leftOriginId = active[visibleIndex - 1].id;
            }

            this.clock++;
            const newId = new CrdtId(this.siteId, this.clock);
            const op = {
                documentId: this.documentId,
                type: 'INSERT',
                id: { siteId: newId.siteId, clock: newId.clock },
                leftOriginId: leftOriginId ? { siteId: leftOriginId.siteId, clock: leftOriginId.clock } : null,
                rightOriginId: null,
                value: charValue,
                senderEmail: senderEmail,
                timestamp: Date.now()
            };

            this.applyInsert(newId, leftOriginId, null, charValue);
            return op;
        }

        /**
         * Generates a local DELETE operation
         */
        localDelete(visibleIndex, senderEmail) {
            const active = this.getActiveCharacters();
            if (visibleIndex < 0 || visibleIndex >= active.length) return null;

            const target = active[visibleIndex];
            target.deleted = true;

            const op = {
                documentId: this.documentId,
                type: 'DELETE',
                id: { siteId: target.id.siteId, clock: target.id.clock },
                senderEmail: senderEmail,
                timestamp: Date.now()
            };

            return op;
        }

        /**
         * Applies remote CRDT operation received over WebSocket
         */
        applyRemote(op) {
            if (!op || !op.id) return false;

            const id = new CrdtId(op.id.siteId, op.id.clock);
            this.clock = Math.max(this.clock, op.id.clock) + 1;

            if (op.type === 'INSERT') {
                const leftId = op.leftOriginId ? new CrdtId(op.leftOriginId.siteId, op.leftOriginId.clock) : null;
                const rightId = op.rightOriginId ? new CrdtId(op.rightOriginId.siteId, op.rightOriginId.clock) : null;
                return this.applyInsert(id, leftId, rightId, op.value);
            } else if (op.type === 'DELETE') {
                return this.applyDelete(id);
            }
            return false;
        }

        applyInsert(id, leftOriginId, rightOriginId, value) {
            const key = id.toString();
            if (this.characterMap.has(key)) return false;

            const newChar = new CrdtCharacter(id, leftOriginId, rightOriginId, value);

            let leftIndex = -1;
            if (leftOriginId) {
                const leftKey = leftOriginId.toString();
                const leftChar = this.characterMap.get(leftKey);
                if (leftChar) {
                    leftIndex = this.characters.indexOf(leftChar);
                }
            }

            let insertIndex = leftIndex + 1;
            while (insertIndex < this.characters.size && insertIndex < this.characters.length) {
                const curr = this.characters[insertIndex];
                let currLeftIndex = -1;
                if (curr.leftOriginId) {
                    const currLeft = this.characterMap.get(curr.leftOriginId.toString());
                    if (currLeft) {
                        currLeftIndex = this.characters.indexOf(currLeft);
                    }
                }

                if (currLeftIndex < leftIndex) {
                    break;
                } else if (currLeftIndex === leftIndex) {
                    if (newChar.id.compareTo(curr.id) > 0) {
                        break;
                    } else {
                        insertIndex++;
                    }
                } else {
                    insertIndex++;
                }
            }

            this.characters.splice(insertIndex, 0, newChar);
            this.characterMap.set(key, newChar);
            return true;
        }

        applyDelete(id) {
            const key = id.toString();
            const char = this.characterMap.get(key);
            if (char && !char.deleted) {
                char.deleted = true;
                return true;
            }
            return false;
        }

        getActiveCharacters() {
            return this.characters.filter(c => !c.deleted);
        }

        toText() {
            return this.getActiveCharacters().map(c => c.value).join('');
        }
    }

    // Attach to window
    window.SyncPadCrdt = new SyncPadCrdtEngine();
})();

