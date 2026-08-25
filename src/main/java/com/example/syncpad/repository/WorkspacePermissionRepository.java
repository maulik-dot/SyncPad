package com.example.syncpad.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;

public interface WorkspacePermissionRepository extends JpaRepository<WorkspacePermission, Long> {
    List<WorkspacePermission> findByWorkspace(Workspace workspace);
    List<WorkspacePermission> findByUser(User user);
    Optional<WorkspacePermission> findByUserAndWorkspace(User user, Workspace workspace);
}
