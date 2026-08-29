package com.example.syncpad.dto.scim;

import java.util.ArrayList;
import java.util.List;

public class ScimPatchRequest {

    private List<String> schemas = List.of("urn:ietf:params:scim:api:messages:2.0:PatchOp");
    private List<Operation> Operations = new ArrayList<>();

    public static class Operation {
        private String op; // add, replace, remove
        private String path;
        private Object value;

        public Operation() {
        }

        public Operation(String op, String path, Object value) {
            this.op = op;
            this.path = path;
            this.value = value;
        }

        public String getOp() {
            return op;
        }

        public void setOp(String op) {
            this.op = op;
        }

        public String getPath() {
            return path;
        }

        public void setPath(String path) {
            this.path = path;
        }

        public Object getValue() {
            return value;
        }

        public void setValue(Object value) {
            this.value = value;
        }
    }

    public ScimPatchRequest() {
    }

    public List<String> getSchemas() {
        return schemas;
    }

    public void setSchemas(List<String> schemas) {
        this.schemas = schemas;
    }

    public List<Operation> getOperations() {
        return Operations;
    }

    public void setOperations(List<Operation> operations) {
        this.Operations = operations;
    }
}
