package com.example.syncpad.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import com.example.syncpad.entity.User;

public interface UserRepository extends JpaRepository<User, Long>{ 
    
    Optional<User> findByEmail(String email);
}
