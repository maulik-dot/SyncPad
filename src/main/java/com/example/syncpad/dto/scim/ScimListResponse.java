package com.example.syncpad.dto.scim;

import java.util.List;

public class ScimListResponse<T> {

    private List<String> schemas = List.of("urn:ietf:params:scim:api:messages:2.0:ListResponse");
    private long totalResults;
    private int startIndex = 1;
    private int itemsPerPage;
    private List<T> Resources;

    public ScimListResponse() {
    }

    public ScimListResponse(long totalResults, int startIndex, int itemsPerPage, List<T> resources) {
        this.totalResults = totalResults;
        this.startIndex = startIndex;
        this.itemsPerPage = itemsPerPage;
        this.Resources = resources;
    }

    public List<String> getSchemas() {
        return schemas;
    }

    public void setSchemas(List<String> schemas) {
        this.schemas = schemas;
    }

    public long getTotalResults() {
        return totalResults;
    }

    public void setTotalResults(long totalResults) {
        this.totalResults = totalResults;
    }

    public int getStartIndex() {
        return startIndex;
    }

    public void setStartIndex(int startIndex) {
        this.startIndex = startIndex;
    }

    public int getItemsPerPage() {
        return itemsPerPage;
    }

    public void setItemsPerPage(int itemsPerPage) {
        this.itemsPerPage = itemsPerPage;
    }

    public List<T> getResources() {
        return Resources;
    }

    public void setResources(List<T> resources) {
        this.Resources = resources;
    }
}
