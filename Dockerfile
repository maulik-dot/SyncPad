# Stage 1: Build the backend
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Runtime stage (Non-Root Unprivileged)
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -d /app -s /sbin/nologin appuser

COPY --from=build --chown=appuser:appgroup /app/target/syncpad-0.0.1-SNAPSHOT.jar app.jar

USER appuser

EXPOSE 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
