package com.example.syncpad.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class ShareForwardController {

    @GetMapping("/share/{token}")
    public String forwardShareLink(@PathVariable String token) {
        return "forward:/?share=" + token;
    }
}

