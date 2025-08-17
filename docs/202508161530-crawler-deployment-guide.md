# 爬蟲任務管理系統部署配置指南

**版本**: v1.0.0  
**日期**: 2025-08-16  
**作者**: Claude  
**類型**: 部署指南

## 概述

本文檔提供了爬蟲任務管理系統的完整部署指南，涵蓋從開發環境到生產環境的各種部署場景。

## 系統需求

### 最低配置

- **CPU**: 2 vCPU
- **記憶體**: 4GB RAM
- **儲存空間**: 20GB SSD
- **網路**: 100Mbps
- **作業系統**: Ubuntu 20.04+ / CentOS 8+ / Docker 支援

### 建議配置

- **CPU**: 4 vCPU
- **記憶體**: 8GB RAM
- **儲存空間**: 50GB SSD
- **網路**: 1Gbps
- **作業系統**: Ubuntu 22.04 LTS

### 軟體需求

```bash
# 後端服務
Node.js: ^23.0.0
PostgreSQL: 14+
Redis: 6.2+
Docker: 20.10+
Docker Compose: 2.0+

# 可選 (生產環境)
Kubernetes: 1.25+
Nginx: 1.20+
Prometheus: 2.35+
Grafana: 9.0+
```

## 環境變數配置

### 開發環境 (.env.development)

```env
# 應用程式配置
NODE_ENV=development
APP_PORT=3000
APP_BASE_URL=http://localhost:3000

# 資料庫配置
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres123
DATABASE_NAME=finance_strategy_dev

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 爬蟲任務管理
CRAWLER_DEFAULT_TIMEOUT=300000
CRAWLER_MAX_RETRIES=3
CRAWLER_HEARTBEAT_INTERVAL=30000
CRAWLER_TASK_REQUEST_INTERVAL=10000
CRAWLER_MAX_CONCURRENT_TASKS=3

# 調度器配置
SCHEDULER_MAINTENANCE_INTERVAL=180000  # 3分鐘
SCHEDULER_CLEANUP_RETENTION_DAYS=90
SCHEDULER_MAX_CONCURRENT_TASKS=100

# JWT 配置
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# 日誌配置
LOG_LEVEL=debug
LOG_FORMAT=json
LOG_DIR=./logs
```

### 測試環境 (.env.test)

```env
# 應用程式配置
NODE_ENV=test
APP_PORT=3001
APP_BASE_URL=http://localhost:3001

# 資料庫配置 (測試資料庫)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres123
DATABASE_NAME=finance_strategy_test

# Redis 配置 (測試資料庫)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1

# 測試專用配置
CRAWLER_DEFAULT_TIMEOUT=10000
CRAWLER_MAX_RETRIES=1
SCHEDULER_MAINTENANCE_INTERVAL=60000  # 1分鐘
```

### 生產環境 (.env.production)

```env
# 應用程式配置
NODE_ENV=production
APP_PORT=3000
APP_BASE_URL=https://api.aha.credit

# 資料庫配置 (生產資料庫)
DATABASE_HOST=db.production.internal
DATABASE_PORT=5432
DATABASE_USERNAME=${DB_USERNAME}
DATABASE_PASSWORD=${DB_PASSWORD}
DATABASE_NAME=finance_strategy_prod
DATABASE_SSL=true
DATABASE_CONNECTION_POOL_SIZE=20

# Redis 配置 (生產快取)
REDIS_HOST=redis.production.internal
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_DB=0
REDIS_TLS=true

# 爬蟲任務管理 (生產配置)
CRAWLER_DEFAULT_TIMEOUT=600000  # 10分鐘
CRAWLER_MAX_RETRIES=5
CRAWLER_HEARTBEAT_INTERVAL=60000  # 1分鐘
CRAWLER_TASK_REQUEST_INTERVAL=30000  # 30秒
CRAWLER_MAX_CONCURRENT_TASKS=10

# 調度器配置 (生產配置)
SCHEDULER_MAINTENANCE_INTERVAL=300000  # 5分鐘
SCHEDULER_CLEANUP_RETENTION_DAYS=180
SCHEDULER_MAX_CONCURRENT_TASKS=500

# JWT 配置 (生產密鑰)
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1d

# 日誌配置 (生產日誌)
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DIR=/var/log/finance-strategy

# 監控配置
METRICS_ENABLED=true
METRICS_PORT=9090
HEALTH_CHECK_ENABLED=true
```

## Docker 部署

### Docker Compose 配置

創建 `docker-compose.yml`:

```yaml
version: '3.9'

services:
  # PostgreSQL 資料庫
  postgres:
    image: postgres:14-alpine
    container_name: finance-postgres
    environment:
      POSTGRES_DB: finance_strategy
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres123
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - finance-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis 快取
  redis:
    image: redis:6.2-alpine
    container_name: finance-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - finance-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 後端應用程式
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: finance-backend
    environment:
      NODE_ENV: production
      DATABASE_HOST: postgres
      REDIS_HOST: redis
    env_file:
      - .env.production
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    ports:
      - "3000:3000"
    networks:
      - finance-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # 爬蟲工作者 (可擴展)
  crawler-worker:
    build:
      context: ../crawler
      dockerfile: Dockerfile
    container_name: crawler-worker-1
    environment:
      WORKER_ID: docker-worker-1
      WORKER_NAME: Docker Crawler Worker 1
      API_BASE_URL: http://backend:3000
      SUPPORTED_REGIONS: TW,US,JP
      SUPPORTED_DATA_TYPES: DAILY,QUARTERLY
      MAX_CONCURRENT_TASKS: 3
    networks:
      - finance-network
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      replicas: 3  # 可動態擴展工作者數量

networks:
  finance-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

### Dockerfile (後端)

創建 `Dockerfile`:

```dockerfile
# 多階段建構
FROM node:23-alpine AS builder

# 設定工作目錄
WORKDIR /app

# 複製 package 檔案
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production && npm cache clean --force

# 複製源碼
COPY . .

# 建構應用程式
RUN npm run build

# 生產階段
FROM node:23-alpine

# 安裝 dumb-init 處理信號
RUN apk add --no-cache dumb-init

# 創建非 root 用戶
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 設定工作目錄
WORKDIR /app

# 複製建構產物
COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist
COPY --chown=nodejs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs --from=builder /app/package*.json ./

# 創建日誌和上傳目錄
RUN mkdir -p logs uploads && \
    chown -R nodejs:nodejs logs uploads

# 切換到非 root 用戶
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# 使用 dumb-init 啟動應用程式
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

### 部署指令

```bash
# 建構並啟動所有服務
docker-compose up -d --build

# 查看服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f backend

# 擴展爬蟲工作者
docker-compose up -d --scale crawler-worker=5

# 停止所有服務
docker-compose down

# 清理所有資料 (慎用)
docker-compose down -v
```

## Kubernetes 部署

### 命名空間配置

創建 `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: finance-strategy
  labels:
    name: finance-strategy
    environment: production
```

### ConfigMap 配置

創建 `k8s/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: finance-config
  namespace: finance-strategy
data:
  NODE_ENV: "production"
  APP_PORT: "3000"
  DATABASE_HOST: "postgres-service"
  DATABASE_PORT: "5432"
  DATABASE_NAME: "finance_strategy"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  CRAWLER_DEFAULT_TIMEOUT: "600000"
  CRAWLER_MAX_RETRIES: "5"
  SCHEDULER_MAINTENANCE_INTERVAL: "300000"
```

### Secret 配置

創建 `k8s/secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: finance-secret
  namespace: finance-strategy
type: Opaque
stringData:
  DATABASE_USERNAME: postgres
  DATABASE_PASSWORD: your-secure-password
  REDIS_PASSWORD: your-redis-password
  JWT_SECRET: your-jwt-secret-key
```

### Deployment 配置

創建 `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: finance-backend
  namespace: finance-strategy
  labels:
    app: finance-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: finance-backend
  template:
    metadata:
      labels:
        app: finance-backend
    spec:
      containers:
      - name: backend
        image: ghcr.io/aryung/finance-strategy:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: finance-config
        - secretRef:
            name: finance-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: logs
        emptyDir: {}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crawler-worker
  namespace: finance-strategy
spec:
  replicas: 5  # 可根據需求調整
  selector:
    matchLabels:
      app: crawler-worker
  template:
    metadata:
      labels:
        app: crawler-worker
    spec:
      containers:
      - name: worker
        image: ghcr.io/aryung/crawler-worker:latest
        env:
        - name: WORKER_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: API_BASE_URL
          value: "http://finance-backend-service:3000"
        - name: MAX_CONCURRENT_TASKS
          value: "3"
        resources:
          requests:
            memory: "512Mi"
            cpu: "200m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### Service 配置

創建 `k8s/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: finance-backend-service
  namespace: finance-strategy
spec:
  selector:
    app: finance-backend
  ports:
  - protocol: TCP
    port: 3000
    targetPort: 3000
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: finance-backend-external
  namespace: finance-strategy
spec:
  selector:
    app: finance-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

### HPA (Horizontal Pod Autoscaler)

創建 `k8s/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: finance-backend-hpa
  namespace: finance-strategy
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: finance-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crawler-worker-hpa
  namespace: finance-strategy
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crawler-worker
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
```

### 部署指令

```bash
# 創建命名空間
kubectl apply -f k8s/namespace.yaml

# 部署配置
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 部署應用程式
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml

# 檢查部署狀態
kubectl get all -n finance-strategy

# 查看 Pod 日誌
kubectl logs -f deployment/finance-backend -n finance-strategy

# 擴展部署
kubectl scale deployment/crawler-worker --replicas=10 -n finance-strategy

# 更新映像
kubectl set image deployment/finance-backend backend=ghcr.io/aryung/finance-strategy:v1.0.1 -n finance-strategy

# 回滾部署
kubectl rollout undo deployment/finance-backend -n finance-strategy
```

## 資料庫初始化

### 初始化腳本

創建 `scripts/init.sql`:

```sql
-- 創建資料庫
CREATE DATABASE finance_strategy;

-- 創建用戶和權限
CREATE USER finance_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE finance_strategy TO finance_user;

-- 切換到資料庫
\c finance_strategy;

-- 創建 schema
CREATE SCHEMA IF NOT EXISTS public;

-- 創建擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 設定時區
SET timezone = 'Asia/Taipei';
```

### Migration 執行

```bash
# 本地執行 migration
npm run db:migration:run

# Docker 環境執行
docker-compose exec backend npm run db:migration:run

# Kubernetes 環境執行
kubectl exec -it deployment/finance-backend -n finance-strategy -- npm run db:migration:run
```

## 監控配置

### Prometheus 指標

創建 `src/monitoring/metrics.ts`:

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// 任務指標
export const taskCounter = new Counter({
  name: 'crawler_tasks_total',
  help: 'Total number of crawler tasks',
  labelNames: ['status', 'exchange_area', 'data_type'],
});

export const taskDuration = new Histogram({
  name: 'crawler_task_duration_seconds',
  help: 'Task execution duration in seconds',
  labelNames: ['exchange_area', 'data_type'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
});

export const activeWorkers = new Gauge({
  name: 'crawler_active_workers',
  help: 'Number of active crawler workers',
  labelNames: ['status'],
});

export const queueSize = new Gauge({
  name: 'crawler_queue_size',
  help: 'Current task queue size',
  labelNames: ['priority'],
});

// 註冊所有指標
register.registerMetric(taskCounter);
register.registerMetric(taskDuration);
register.registerMetric(activeWorkers);
register.registerMetric(queueSize);
```

### 健康檢查端點

創建 `src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private connection: Connection,
    @InjectRedis() private redis: Redis,
  ) {}

  @Get()
  async check() {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: false,
        redis: false,
        application: true,
      },
    };

    // 檢查資料庫
    try {
      await this.connection.query('SELECT 1');
      checks.services.database = true;
    } catch (error) {
      checks.status = 'unhealthy';
    }

    // 檢查 Redis
    try {
      await this.redis.ping();
      checks.services.redis = true;
    } catch (error) {
      checks.status = 'unhealthy';
    }

    return checks;
  }

  @Get('ready')
  async ready() {
    // 檢查應用程式是否準備好接收流量
    return {
      ready: true,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  async metrics() {
    // Prometheus 格式的指標
    const { register } = await import('prom-client');
    return register.metrics();
  }
}
```

## 生產環境優化

### 性能優化

1. **資料庫連接池**
   ```typescript
   TypeOrmModule.forRoot({
     type: 'postgres',
     // ... 其他配置
     extra: {
       max: 20,  // 最大連接數
       min: 5,   // 最小連接數
       idleTimeoutMillis: 30000,
       connectionTimeoutMillis: 2000,
     },
   })
   ```

2. **Redis 連接池**
   ```typescript
   RedisModule.forRoot({
     config: {
       // ... 其他配置
       maxRetriesPerRequest: 3,
       enableReadyCheck: true,
       lazyConnect: true,
     },
   })
   ```

3. **Node.js 優化**
   ```bash
   # 生產環境啟動指令
   NODE_ENV=production \
   NODE_OPTIONS="--max-old-space-size=4096" \
   node dist/main.js
   ```

### 安全最佳實踐

1. **環境變數管理**
   - 使用 Kubernetes Secrets 或 AWS Secrets Manager
   - 避免在程式碼中硬編碼敏感資訊
   - 定期輪換密鑰和密碼

2. **網路安全**
   - 使用 TLS/SSL 加密所有通訊
   - 配置防火牆規則限制訪問
   - 使用 VPN 或私有網路

3. **應用程式安全**
   ```typescript
   // Helmet 中間件
   app.use(helmet());
   
   // CORS 配置
   app.enableCors({
     origin: process.env.ALLOWED_ORIGINS?.split(','),
     credentials: true,
   });
   
   // Rate limiting
   app.use(
     rateLimit({
       windowMs: 15 * 60 * 1000,
       max: 100,
     }),
   );
   ```

### 日誌管理

1. **集中式日誌**
   ```yaml
   # Fluentd DaemonSet
   apiVersion: apps/v1
   kind: DaemonSet
   metadata:
     name: fluentd
   spec:
     selector:
       matchLabels:
         name: fluentd
     template:
       spec:
         containers:
         - name: fluentd
           image: fluent/fluentd-kubernetes-daemonset:v1-debian-elasticsearch
           volumeMounts:
           - name: varlog
             mountPath: /var/log
   ```

2. **日誌格式化**
   ```typescript
   import { WinstonModule } from 'nest-winston';
   import * as winston from 'winston';
   
   WinstonModule.forRoot({
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.json(),
     ),
     transports: [
       new winston.transports.Console(),
       new winston.transports.File({
         filename: 'error.log',
         level: 'error',
       }),
     ],
   });
   ```

## 備份和災難恢復

### 資料庫備份

```bash
#!/bin/bash
# backup.sh

# 設定變數
BACKUP_DIR="/backups"
DB_NAME="finance_strategy"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 執行備份
pg_dump -h $DATABASE_HOST -U $DATABASE_USER -d $DB_NAME | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# 保留最近 30 天的備份
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

### 恢復程序

```bash
#!/bin/bash
# restore.sh

# 恢復資料庫
gunzip < backup_20250816_120000.sql.gz | psql -h $DATABASE_HOST -U $DATABASE_USER -d $DB_NAME

# 執行 migration
npm run db:migration:run

# 重啟服務
kubectl rollout restart deployment/finance-backend -n finance-strategy
```

## 監控告警配置

### AlertManager 規則

創建 `monitoring/alerts.yaml`:

```yaml
groups:
- name: crawler_alerts
  rules:
  - alert: HighTaskFailureRate
    expr: rate(crawler_tasks_total{status="failed"}[5m]) > 0.1
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "High task failure rate detected"
      description: "Task failure rate is {{ $value }} per second"

  - alert: WorkerOffline
    expr: crawler_active_workers{status="online"} < 1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "No active workers available"
      description: "All crawler workers are offline"

  - alert: QueueBacklog
    expr: crawler_queue_size > 1000
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: "Large task queue backlog"
      description: "Queue size is {{ $value }}"
```

## 部署檢查清單

### 部署前檢查

- [ ] 環境變數配置正確
- [ ] 資料庫連接測試通過
- [ ] Redis 連接測試通過
- [ ] Migration 執行完成
- [ ] 健康檢查端點正常
- [ ] 日誌目錄權限設置
- [ ] SSL 證書配置
- [ ] 防火牆規則設置

### 部署後驗證

- [ ] 所有 Pod 運行正常
- [ ] 服務端點可訪問
- [ ] 健康檢查通過
- [ ] 監控指標收集正常
- [ ] 日誌收集正常
- [ ] 備份任務配置
- [ ] 告警規則生效
- [ ] 性能基準測試

## 故障處理

### 常見問題

1. **資料庫連接失敗**
   ```bash
   # 檢查連接
   kubectl exec -it deployment/finance-backend -- nc -zv postgres-service 5432
   
   # 檢查憑證
   kubectl get secret finance-secret -o yaml
   ```

2. **記憶體不足**
   ```bash
   # 增加資源限制
   kubectl patch deployment finance-backend -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"1Gi"}}}]}}}}'
   ```

3. **任務積壓**
   ```bash
   # 擴展工作者
   kubectl scale deployment/crawler-worker --replicas=10
   
   # 檢查任務狀態
   kubectl exec -it deployment/finance-backend -- npm run task:status
   ```

## 總結

本部署指南提供了完整的部署方案，從開發環境到生產環境的各種場景。關鍵要點：

✅ **多環境支援**: 開發、測試、生產環境配置  
✅ **容器化部署**: Docker 和 Kubernetes 支援  
✅ **高可用性**: 自動擴展和負載平衡  
✅ **監控完備**: Prometheus 指標和健康檢查  
✅ **安全加固**: 最佳實踐和安全配置  
✅ **災難恢復**: 備份和恢復程序  

遵循本指南可確保系統穩定、安全、高效地運行在生產環境中。

---

**文檔完成**: 2025-08-16  
**維護者**: DevOps Team  
**更新頻率**: 每季度審查  
**下一次審查**: 2025-11-16