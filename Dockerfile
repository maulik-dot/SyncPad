# Stage 1: Build the frontend
FROM node:22-alpine AS frontend-build
WORKDIR /frontend
RUN npm install -g pnpm
COPY ["Document Workspace Design/package.json", "Document Workspace Design/pnpm-lock.yaml", "./"]
RUN pnpm install --frozen-lockfile
COPY ["Document Workspace Design/", "./"]
RUN pnpm build

# Stage 2: Build the backend
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
COPY --from=frontend-build /frontend/dist ./src/main/resources/static
RUN mvn clean package -DskipTests

# Stage 3: Runtime stage (Non-Root Unprivileged)
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -d /app -s /sbin/nologin appuser

COPY --from=build --chown=appuser:appgroup /app/target/syncpad-0.0.1-SNAPSHOT.jar app.jar

USER appuser

EXPOSE 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
