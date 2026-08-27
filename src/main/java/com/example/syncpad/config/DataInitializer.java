package com.example.syncpad.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.FileType;
import com.example.syncpad.entity.Folder;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.FolderRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final FolderRepository folderRepository;
    private final DocumentRepository documentRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            FolderRepository folderRepository,
            DocumentRepository documentRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.folderRepository = folderRepository;
        this.documentRepository = documentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @org.springframework.beans.factory.annotation.Value("${app.seed-demo-user:false}")
    private boolean seedDemoUser;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        if (seedDemoUser && userRepository.findByEmail("demo@syncpad.com").isEmpty()) {
            // Seed Demo User account for development testing if explicitly enabled
            User user = new User("Alex Morgan", "demo@syncpad.com", passwordEncoder.encode("password123"));
            userRepository.save(user);
        }
    }
}
