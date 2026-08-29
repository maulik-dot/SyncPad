package com.example.syncpad.dto.request;

public class AddTagRequest {
    private Long tagId;
    private String name;
    private String color;

    public AddTagRequest() {}

    public AddTagRequest(String name, String color) {
        this.name = name;
        this.color = color;
    }

    public AddTagRequest(Long tagId) {
        this.tagId = tagId;
    }

    public Long getTagId() { return tagId; }
    public void setTagId(Long tagId) { this.tagId = tagId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
}