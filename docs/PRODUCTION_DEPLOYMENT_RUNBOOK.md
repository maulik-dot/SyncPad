# SyncPad Enterprise Production Deployment & Operations Runbook

This runbook provides step-by-step procedures for deploying, maintaining, and scaling SyncPad in production environments using **Terraform** (AWS/Cloud) and **Kubernetes** (`k8s/`).

---

## 1. Architecture Overview

```
                          Internet Traffic (Port 443 HTTPS / WSS)
                                            │
                                            ▼
                           [ NGINX Ingress Controller ]
                         (TLS Termination via Cert-Manager)
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
         [ Static Web / UI ]                             [ WebSocket Handshake ]
         (GET / , /assets/*)                              (GET /ws /ws/info)
                    │                                               │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                               [ syncpad-backend Service ]
                                            │
                 ┌──────────────────────────┴──────────────────────────┐
                 ▼                                                     ▼
    [ syncpad-backend Pod 1 ]                             [ syncpad-backend Pod 2 ]
  (Spring Boot / Java 21 non-root)                      (Spring Boot / Java 21 non-root)
                 │                                                     │
                 ├──────────────────────────┬──────────────────────────┤
                 ▼                          ▼                          ▼
        [ Managed RDS / PG ]      [ RabbitMQ STOMP Relay ]   [ Prometheus Scrape ]
        (PostgreSQL 16 Multi-AZ)   (Port 61613 STOMP Broker)   (Port 8082 /actuator)
```

---

## 2. Cloud Infrastructure Provisioning (Terraform)

### Prerequisites:
- AWS CLI configured with administrator or infrastructure provisioning credentials.
- Terraform `>= 1.5.0` installed.

### Step 1: Initialize Terraform
```bash
cd terraform
terraform init
```

### Step 2: Configure Production Variables
Create `terraform/environments/prod.tfvars` from the provided example:
```bash
cp environments/prod.tfvars.example environments/prod.tfvars
```
Update `domain_name`, `aws_region`, and `vpc_cidr` as appropriate for your organization.

### Step 3: Plan and Apply Infrastructure
```bash
terraform plan -var-file="environments/prod.tfvars" -out=tfplan
terraform apply tfplan
```

### Step 4: Capture Provisioned Outputs
```bash
export RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
export S3_BACKUP_BUCKET=$(terraform output -raw s3_backup_bucket_id)
export KMS_KEY_ARN=$(terraform output -raw kms_key_arn)
```

---

## 3. Kubernetes Cluster Deployment (`k8s/`)

### Prerequisites:
- `kubectl` configured with cluster access (`aws eks update-kubeconfig --name syncpad-prod-cluster`).
- Ingress-NGINX and Cert-Manager installed on the cluster:
  ```bash
  # Install Ingress-NGINX
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml

  # Install Cert-Manager
  kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml
  ```

### Step 1: Populate Production Secrets
Generate strong cryptographically secure keys:
```bash
export DB_PASS=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -hex 32)
export STOMP_PASS=$(openssl rand -base64 24)
export BACKUP_PASS=$(openssl rand -base64 32)
```

Apply secrets to the cluster:
```bash
kubectl create namespace syncpad --dry-run=client -o yaml | kubectl apply -f -

kubectl -n syncpad create secret generic syncpad-secrets \
  --from-literal=SPRING_DATASOURCE_PASSWORD="${DB_PASS}" \
  --from-literal=POSTGRES_PASSWORD="${DB_PASS}" \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=RABBITMQ_PASSWORD="${STOMP_PASS}" \
  --from-literal=BACKUP_PASSPHRASE="${BACKUP_PASS}" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Step 2: Deploy All Components via Kustomize
```bash
kubectl apply -k k8s/
```

### Step 3: Verify Deployment Rollout & Health
```bash
# Check pod startup and readiness
kubectl -n syncpad get pods -o wide

# Verify rolling update status
kubectl -n syncpad rollout status deployment/syncpad-backend

# Check Ingress & TLS Certificate Status
kubectl -n syncpad get ingress
kubectl -n syncpad get certificates
```

---

## 4. Zero-Downtime Rolling Updates

SyncPad uses Spring Boot health probes (`/actuator/health/readiness` and `liveness`) coupled with Kubernetes `RollingUpdate` (`maxSurge: 1`, `maxUnavailable: 0`) to guarantee zero downtime during version updates.

### Deployment Command:
```bash
# 1. Build and push new container image
docker build -t your-registry.com/syncpad:v2.1.0 .
docker push your-registry.com/syncpad:v2.1.0

# 2. Update Kubernetes Deployment
kubectl -n syncpad set image deployment/syncpad-backend syncpad-app=your-registry.com/syncpad:v2.1.0

# 3. Monitor rollout progression
kubectl -n syncpad rollout status deployment/syncpad-backend
```

### Rollback Procedure:
If unexpected errors or performance degradation occur:
```bash
kubectl -n syncpad rollout undo deployment/syncpad-backend
```

---

## 5. Automated Database Backups & Disaster Recovery

### Automated Nightly Backups:
- The `syncpad-db-backup` CronJob runs daily at `02:00 UTC`.
- It streams `pg_dump` into `gzip`, encrypts on-the-fly using `openssl enc -aes-256-cbc -pbkdf2` with `BACKUP_PASSPHRASE`, and calculates a SHA256 checksum.

### Manual Backup On-Demand:
```bash
kubectl -n syncpad create job --from=cronjob/syncpad-db-backup manual-backup-$(date +%s)
```

### Database Restoration Procedure:
To restore an encrypted backup archive:
```bash
# Using the SyncPad restore script:
./scripts/restore_db.sh /path/to/backup.sql.gz.enc --force
```

---

## 6. Observability & Incident Response

### Key Metrics to Monitor:
- **P95 / P99 HTTP Latency**: Alert threshold > 2000ms for 5 minutes.
- **HTTP 5xx Error Rate**: Alert threshold > 5% over 5 minutes.
- **HikariCP Pool Saturation**: Active connections / Max connections > 90%.
- **JVM Heap Usage**: Used memory > 85% of total allocated memory.

### Triage Commands:
```bash
# View aggregated application logs
kubectl -n syncpad logs -l app.kubernetes.io/name=syncpad-backend --tail=100 -f

# Check container resource consumption
kubectl -n syncpad top pods

# Inspect Kubernetes events for pod restarts or probe failures
kubectl -n syncpad get events --sort-by='.metadata.creationTimestamp'
```
