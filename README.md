# ⚡ SyncPad — Real-time Collaborative Document Workspace

[![CI Pipeline](https://github.com/maulikmahey/SyncPad/actions/workflows/ci.yml/badge.svg)](https.github.com)
[![Java 21](https://img.shields.io/badge/Java-21-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.0.7-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**SyncPad** is an enterprise-ready, real-time collaborative document platform designed to deliver Google Docs-style live editing, document sharing, immutable version history, and stateless security.

---

## 🌟 Key Features

* **🛡️ Stateless JWT Security & Auth**: Password hashing with BCrypt, stateless JWT tokens, and automated SecurityContext user derivation.
* **👥 Role-Based Collaboration & Sharing**: Fine-grained role permissions (`OWNER`, `EDITOR`, `VIEWER`) per document.
* **⚡ Real-time WebSockets & STOMP**: Sub-second live typing synchronization across collaborators over STOMP WebSocket channels (`/topic/documents/{id}`).
* **📜 Immutable Version History Snapshots**: Automatic snapshot generation on creation and edits, point-in-time document restoration.
* **🔒 Production Hardening & Concurrency**: JPA `@Version` optimistic locking to prevent concurrent overwrites and centralized `@RestControllerAdvice` error responses.
* **📑 OpenAPI 3 & Swagger UI**: Interactive API documentation with built-in JWT Bearer authorization testing at `/swagger-ui/index.html`.
* **🐳 Docker & One-Command Deployment**: Complete multi-stage `Dockerfile` and `docker-compose.yml` environment with healthchecks.

---

## 🏗️ System Architecture

```
                                  ┌───────────────────────────────┐
                                  │      Client (Browser A/B)     │
                                  └──────────────┬────────────────┘
                                                 │
                                     REST / STOMP over WebSocket
                                                 │
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │    Spring Boot 4.0 Backend    │
                                  ├───────────────────────────────┤
                                  │  • SecurityFilterChain (JWT)  │
                                  │  • STOMP Message Broker       │
                                  │  • DocumentService            │
                                  │  • GlobalExceptionHandler     │
                                  └──────────────┬────────────────┘
                                                 │
                                            JPA / Hibernate
                                                 │
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │    PostgreSQL Database 16     │
                                  │  • users                      │
                                  │  • document                   │
                                  │  • document_permissions       │
                                  │  • document_versions          │
                                  └───────────────────────────────┘
```

---

## 🚀 Quick Start

### Option 1: Running with Docker Compose (Recommended)
```bash
# Clone repository
git clone https://github.com/maulikmahey/SyncPad.git
cd SyncPad

# Launch Spring Boot & PostgreSQL containers
docker compose up --build
```
Access the application UI at **http://localhost:8082** or open Swagger UI at **http://localhost:8082/swagger-ui/index.html**.

### Option 2: Local Development Setup
Ensure PostgreSQL is running locally on port 5432 with database `syncpad_db`.

```bash
# Compile and package project
./mvnw clean package

# Run application
./mvnw spring-boot:run
```

---

## 📖 API Documentation & Swagger UI

Interactive Swagger UI documentation is live at:
👉 **[http://localhost:8082/swagger-ui/index.html](http://localhost:8082/swagger-ui/index.html)**

### Core REST Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Register a new user | ❌ No |
| `POST` | `/auth/login` | Authenticate user and receive JWT token | ❌ No |
| `POST` | `/documents` | Create a new document (creator becomes `OWNER`) | ✅ Bearer JWT |
| `GET` | `/documents` | List all accessible documents for current user | ✅ Bearer JWT |
| `GET` | `/documents/{id}` | Get document by ID (Requires `OWNER`, `EDITOR`, or `VIEWER`) | ✅ Bearer JWT |
| `PUT` | `/documents/{id}` | Update document title & content (`OWNER` or `EDITOR`) | ✅ Bearer JWT |
| `DELETE`| `/documents/{id}` | Delete document (`OWNER` only) | ✅ Bearer JWT |
| `POST` | `/documents/{id}/share` | Share document with collaborator (`OWNER` only) | ✅ Bearer JWT |
| `GET` | `/documents/{id}/versions` | List snapshot version history | ✅ Bearer JWT |
| `POST` | `/documents/{id}/restore/{versionNumber}` | Restore document to past version snapshot | ✅ Bearer JWT |

---

## 🧪 Testing Suite

Run full unit and integration tests with Maven:

```bash
# Run unit & integration tests
./mvnw clean test
```

### Test Coverage Highlights
* **Unit Tests (`AuthServiceTest`, `DocumentServiceTest`)**: Mockito unit tests verifying business rules, duplicate prevention, and role-based permission enforcement.
* **Integration Tests (`AuthIntegrationTest`)**: Spring Boot REST test validating full registration, token parsing, and authentication workflow.

---

## 📄 License
Distributed under the **MIT License**. See `LICENSE` for details.
