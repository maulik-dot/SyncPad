package com.example.syncpad.service;
import org.springframework.stereotype.Service;

import com.example.syncpad.repository.UserRepository;

@Service
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository){
        this.userRepository = userRepository;
    }

    
}
