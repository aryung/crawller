# 爬蟲任務管理系統故障排除指南

**版本**: v1.0.0  
**日期**: 2025-08-16  
**作者**: Claude  
**類型**: 故障排除指南

## 概述

本文檔提供了爬蟲任務管理系統的完整故障排除指南，涵蓋常見問題診斷、效能調優、錯誤分析和恢復程序。

## 診斷工具和指令

### 基礎檢查指令

```bash
# 系統狀態檢查
curl -f http://localhost:3000/health
curl -f http://localhost:3000/health/ready
curl -f http://localhost:3000/monitor/statistics

# 資料庫連接檢查
npm run db:query "SELECT 1 as health_check;"

# 查看系統日誌
npm run logs:view
tail -f logs/dev-*.log

# 檢查 Redis 連接
redis-cli ping

# 檢查活動任務
npm run db:query "SELECT status, COUNT(*) FROM crawler_tasks GROUP BY status;"

# 檢查工作者狀態
npm run db:query "SELECT id, status, last_heartbeat FROM crawler_workers;"
```

### Docker 環境診斷

```bash
# 檢查容器狀態
docker-compose ps
docker-compose logs backend
docker-compose logs crawler-worker

# 檢查容器資源使用
docker stats

# 進入容器調試
docker-compose exec backend sh
docker-compose exec postgres psql -U postgres -d finance_strategy

# 檢查網路連接
docker-compose exec backend nc -zv postgres 5432
docker-compose exec backend nc -zv redis 6379
```

### Kubernetes 環境診斷

```bash
# 檢查 Pod 狀態
kubectl get pods -n finance-strategy
kubectl describe pod <pod-name> -n finance-strategy

# 檢查日誌
kubectl logs -f deployment/finance-backend -n finance-strategy
kubectl logs --previous <pod-name> -n finance-strategy

# 檢查資源使用
kubectl top pods -n finance-strategy
kubectl top nodes

# 檢查事件
kubectl get events -n finance-strategy --sort-by='.lastTimestamp'

# 進入 Pod 調試
kubectl exec -it <pod-name> -n finance-strategy -- sh

# 檢查配置
kubectl get configmap finance-config -o yaml -n finance-strategy
kubectl get secret finance-secret -o yaml -n finance-strategy
```

## 常見問題與解決方案

### 1. 應用程式啟動問題

#### 問題: 服務無法啟動

**症狀**:
```
Error: Cannot connect to database
ConnectionError: Failed to connect to PostgreSQL
```

**診斷步驟**:
```bash
# 1. 檢查環境變數
env | grep DATABASE

# 2. 檢查資料庫連接
nc -zv $DATABASE_HOST $DATABASE_PORT

# 3. 檢查資料庫服務狀態
docker-compose ps postgres
kubectl get pods -l app=postgres -n finance-strategy

# 4. 檢查認證
psql -h $DATABASE_HOST -U $DATABASE_USERNAME -d $DATABASE_NAME
```

**解決方案**:
```bash
# 方案 1: 重啟資料庫服務
docker-compose restart postgres
kubectl rollout restart deployment/postgres -n finance-strategy

# 方案 2: 檢查並修正環境變數
vim .env.production
kubectl edit configmap finance-config -n finance-strategy

# 方案 3: 重建資料庫連接
docker-compose down postgres
docker-compose up -d postgres
```

#### 問題: Migration 執行失敗

**症狀**:
```
QueryFailedError: relation "crawler_tasks" already exists
MigrationRunError: Migration failed
```

**診斷步驟**:
```bash
# 檢查 Migration 狀態
npm run db:query "SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;"

# 檢查表結構
npm run db:query "\dt"
npm run db:query "\d crawler_tasks"
```

**解決方案**:
```bash
# 方案 1: 重置 Migration
npm run db:migration:revert
npm run db:migration:run

# 方案 2: 手動修復
npm run db:query "DROP TABLE IF EXISTS migrations;"
npm run db:migration:run

# 方案 3: 完全重建資料庫 (慎用)
docker-compose down postgres -v
docker-compose up -d postgres
npm run db:migration:run
```

### 2. 任務執行問題

#### 問題: 任務無法分配給工作者

**症狀**:
```
警告: 沒有可用的工作者
錯誤: 任務分配失敗
```

**診斷步驟**:
```bash
# 1. 檢查工作者狀態
npm run db:query "
SELECT id, status, last_heartbeat, 
       EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) as seconds_since_heartbeat
FROM crawler_workers;"

# 2. 檢查任務隊列
npm run db:query "
SELECT status, COUNT(*) as count
FROM crawler_tasks
WHERE is_active = true
GROUP BY status;"

# 3. 檢查分配算法日誌
grep "TaskAssignment" logs/dev-*.log | tail -20
```

**解決方案**:
```bash
# 方案 1: 重啟離線工作者
docker-compose restart crawler-worker
kubectl rollout restart deployment/crawler-worker -n finance-strategy

# 方案 2: 清理過期工作者
npm run db:query "
UPDATE crawler_workers 
SET status = 'offline' 
WHERE last_heartbeat < NOW() - INTERVAL '5 minutes';"

# 方案 3: 重置超時任務
npm run db:query "
UPDATE crawler_tasks 
SET status = 'pending', assigned_to = NULL, assigned_at = NULL
WHERE status = 'assigned' 
AND assigned_at < NOW() - INTERVAL '10 minutes';"

# 方案 4: 手動觸發維護
curl -X POST http://localhost:3000/monitor/maintenance/trigger
```

#### 問題: 任務執行超時

**症狀**:
```
任務 ID: abc-123 執行超時
工作者: worker-1 無回應
```

**診斷步驟**:
```bash
# 1. 檢查超時任務
npm run db:query "
SELECT id, symbol_code, status, assigned_to, 
       EXTRACT(EPOCH FROM (NOW() - started_at))/60 as minutes_running
FROM crawler_tasks 
WHERE status = 'running' 
AND started_at < NOW() - INTERVAL '10 minutes';"

# 2. 檢查工作者負載
npm run db:query "
SELECT w.id, w.current_load, w.max_concurrent_tasks,
       COUNT(t.id) as active_tasks
FROM crawler_workers w
LEFT JOIN crawler_tasks t ON w.id = t.assigned_to AND t.status = 'running'
GROUP BY w.id, w.current_load, w.max_concurrent_tasks;"

# 3. 檢查錯誤日誌
grep "timeout\|error" logs/dev-*.log | tail -20
```

**解決方案**:
```bash
# 方案 1: 增加超時時間
npm run db:query "
UPDATE crawler_tasks 
SET timeout_seconds = 1200 
WHERE timeout_seconds < 600;"

# 方案 2: 終止超時任務
npm run db:query "
UPDATE crawler_tasks 
SET status = 'failed', 
    completed_at = NOW()
WHERE status = 'running' 
AND started_at < NOW() - INTERVAL '20 minutes';"

# 方案 3: 重啟問題工作者
docker kill crawler-worker-1
docker-compose up -d --scale crawler-worker=3
```

### 3. 性能問題

#### 問題: 任務處理速度緩慢

**症狀**:
```
任務隊列積壓 > 1000
平均執行時間 > 5 分鐘
工作者利用率 < 50%
```

**診斷步驟**:
```bash
# 1. 檢查系統資源
top
htop
free -h
df -h

# 2. 檢查資料庫性能
npm run db:query "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;"

# 3. 檢查 Redis 性能
redis-cli info stats
redis-cli slowlog get 10

# 4. 檢查任務分布
npm run db:query "
SELECT exchange_area, data_type, 
       COUNT(*) as task_count,
       AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
FROM crawler_history 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY exchange_area, data_type;"
```

**解決方案**:
```bash
# 方案 1: 增加工作者數量
docker-compose up -d --scale crawler-worker=10
kubectl scale deployment/crawler-worker --replicas=15 -n finance-strategy

# 方案 2: 優化資料庫查詢
npm run db:query "CREATE INDEX CONCURRENTLY idx_tasks_status_priority 
ON crawler_tasks(status, priority) WHERE is_active = true;"

# 方案 3: 調整並發設定
# 編輯環境變數
CRAWLER_MAX_CONCURRENT_TASKS=5

# 方案 4: 啟用 Redis 緩存
REDIS_TTL=300
CACHE_WORKER_CAPABILITIES=true
```

#### 問題: 記憶體使用過高

**症狀**:
```
記憶體使用 > 2GB
Node.js heap out of memory
容器 OOMKilled
```

**診斷步驟**:
```bash
# 1. 檢查記憶體使用
docker stats
kubectl top pods -n finance-strategy

# 2. 檢查 Node.js heap
curl http://localhost:3000/health/memory

# 3. 檢查任務大小
npm run db:query "
SELECT symbol_code, 
       LENGTH(config_override::text) as config_size,
       LENGTH(response_summary::text) as response_size
FROM crawler_tasks 
ORDER BY config_size DESC LIMIT 10;"
```

**解決方案**:
```bash
# 方案 1: 增加記憶體限制
docker-compose.yml:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G

# Kubernetes:
kubectl patch deployment finance-backend -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "resources": {
            "limits": {"memory": "2Gi"},
            "requests": {"memory": "1Gi"}
          }
        }]
      }
    }
  }
}'

# 方案 2: 調整 Node.js heap 大小
NODE_OPTIONS="--max-old-space-size=4096"

# 方案 3: 清理過期數據
npm run db:query "
DELETE FROM crawler_history 
WHERE created_at < NOW() - INTERVAL '30 days';"

npm run db:query "
DELETE FROM crawler_failures 
WHERE created_at < NOW() - INTERVAL '7 days' 
AND resolved_at IS NOT NULL;"
```

### 4. 網路和連接問題

#### 問題: 工作者無法連接到後端

**症狀**:
```
ConnectionError: ECONNREFUSED 
工作者註冊失敗
心跳超時
```

**診斷步驟**:
```bash
# 1. 檢查網路連接
nc -zv localhost 3000
curl -v http://localhost:3000/health

# 2. 檢查防火牆
iptables -L
ufw status

# 3. 檢查 DNS 解析
nslookup backend-service
dig backend-service

# Docker 網路檢查
docker network ls
docker network inspect finance-strategy_default
```

**解決方案**:
```bash
# 方案 1: 重啟網路服務
docker-compose down
docker-compose up -d

# 方案 2: 檢查網路配置
# docker-compose.yml
networks:
  finance-network:
    driver: bridge

# 方案 3: 修復 DNS
# 在工作者容器中
echo "172.18.0.2 backend" >> /etc/hosts

# 方案 4: 使用 IP 地址
BACKEND_URL=http://172.18.0.2:3000
```

### 5. 資料一致性問題

#### 問題: 任務狀態不一致

**症狀**:
```
任務顯示運行中但工作者已離線
重複任務執行
數據不同步
```

**診斷步驟**:
```bash
# 1. 檢查孤立任務
npm run db:query "
SELECT t.id, t.status, t.assigned_to, w.status as worker_status
FROM crawler_tasks t
LEFT JOIN crawler_workers w ON t.assigned_to = w.id
WHERE t.status IN ('assigned', 'running') 
AND (w.id IS NULL OR w.status != 'online');"

# 2. 檢查重複任務
npm run db:query "
SELECT symbol_code, exchange_area, data_type, COUNT(*)
FROM crawler_tasks
WHERE status IN ('pending', 'assigned', 'running')
GROUP BY symbol_code, exchange_area, data_type
HAVING COUNT(*) > 1;"

# 3. 檢查數據完整性
npm run db:query "
SELECT COUNT(*) as orphaned_history
FROM crawler_history h
LEFT JOIN crawler_tasks t ON h.task_id = t.id
WHERE t.id IS NULL;"
```

**解決方案**:
```bash
# 方案 1: 清理孤立任務
npm run db:query "
UPDATE crawler_tasks 
SET status = 'pending', assigned_to = NULL, assigned_at = NULL
WHERE assigned_to NOT IN (
  SELECT id FROM crawler_workers WHERE status = 'online'
) AND status IN ('assigned', 'running');"

# 方案 2: 合併重複任務
npm run db:query "
DELETE FROM crawler_tasks t1 
USING crawler_tasks t2
WHERE t1.id > t2.id 
AND t1.symbol_code = t2.symbol_code
AND t1.exchange_area = t2.exchange_area
AND t1.data_type = t2.data_type
AND t1.status = 'pending' 
AND t2.status = 'pending';"

# 方案 3: 重建索引
npm run db:query "REINDEX DATABASE finance_strategy;"

# 方案 4: 手動觸發數據同步
curl -X POST http://localhost:3000/monitor/maintenance/sync-data
```

## 錯誤分析和日誌調試

### 日誌分析技巧

```bash
# 1. 按錯誤類型分組
grep -E "(ERROR|FATAL)" logs/dev-*.log | \
  awk '{print $4}' | sort | uniq -c | sort -nr

# 2. 查找特定任務錯誤
grep "task-id-abc-123" logs/dev-*.log

# 3. 分析性能瓶頸
grep "slow query\|timeout\|high memory" logs/dev-*.log | tail -20

# 4. 監控錯誤趨勢
for log in logs/dev-*.log; do
  echo "=== $log ==="
  grep -c "ERROR" "$log"
done

# 5. 實時錯誤監控
tail -f logs/dev-*.log | grep --color=always -E "(ERROR|WARN|FATAL)"
```

### 錯誤代碼對照表

| 錯誤代碼 | 說明 | 可能原因 | 解決方案 |
|---------|------|----------|----------|
| `TASK_001` | 任務創建失敗 | 參數驗證錯誤 | 檢查輸入參數格式 |
| `TASK_002` | 任務分配失敗 | 無可用工作者 | 增加工作者或檢查工作者狀態 |
| `TASK_003` | 任務執行超時 | 網路延遲或資源不足 | 增加超時時間或檢查資源 |
| `WORKER_001` | 工作者註冊失敗 | 網路連接問題 | 檢查網路配置 |
| `WORKER_002` | 心跳超時 | 工作者離線 | 重啟工作者服務 |
| `DB_001` | 資料庫連接失敗 | 認證或網路問題 | 檢查連接字串和認證 |
| `DB_002` | 查詢超時 | 查詢複雜度過高 | 優化查詢或增加索引 |
| `REDIS_001` | Redis 連接失敗 | Redis 服務離線 | 重啟 Redis 服務 |

### 性能監控和分析

```bash
# 1. 系統資源監控
#!/bin/bash
# monitor.sh
while true; do
  echo "=== $(date) ==="
  echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)"
  echo "Memory: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
  echo "Disk: $(df -h / | awk 'NR==2{print $5}')"
  echo "Active Tasks: $(curl -s localhost:3000/monitor/statistics | jq .tasks.running)"
  echo "Queue Size: $(curl -s localhost:3000/monitor/statistics | jq .tasks.pending)"
  echo "Workers Online: $(curl -s localhost:3000/monitor/statistics | jq .workers.online)"
  echo "---"
  sleep 30
done

# 2. 資料庫性能分析
npm run db:query "
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('crawler_tasks', 'crawler_workers');
"

# 3. 查詢執行計劃
npm run db:query "
EXPLAIN ANALYZE 
SELECT * FROM crawler_tasks 
WHERE status = 'pending' 
AND exchange_area = 'TW' 
ORDER BY priority DESC 
LIMIT 10;
"
```

## 預防性維護

### 定期檢查清單

**每日檢查**:
- [ ] 系統健康狀態
- [ ] 錯誤日誌數量
- [ ] 任務隊列長度
- [ ] 工作者在線數量
- [ ] 資源使用率

**每週檢查**:
- [ ] 資料庫性能分析
- [ ] 日誌文件大小
- [ ] 過期數據清理
- [ ] 備份完整性
- [ ] 安全更新

**每月檢查**:
- [ ] 性能基準測試
- [ ] 容量規劃評估
- [ ] 災難恢復演練
- [ ] 文檔更新
- [ ] 依賴項更新

### 自動化監控腳本

```bash
#!/bin/bash
# health_check.sh

API_URL="http://localhost:3000"
ALERT_THRESHOLD=80
LOG_FILE="/var/log/health_check.log"

# 檢查 API 健康狀態
health_response=$(curl -s "$API_URL/health" || echo '{"status":"unhealthy"}')
status=$(echo "$health_response" | jq -r '.status')

if [ "$status" != "healthy" ]; then
  echo "$(date): API unhealthy - $health_response" >> "$LOG_FILE"
  # 發送告警
  curl -X POST "$WEBHOOK_URL" -d "API is unhealthy: $health_response"
fi

# 檢查資源使用率
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | cut -d'.' -f1)
if [ "$cpu_usage" -gt "$ALERT_THRESHOLD" ]; then
  echo "$(date): High CPU usage: $cpu_usage%" >> "$LOG_FILE"
fi

memory_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ "$memory_usage" -gt "$ALERT_THRESHOLD" ]; then
  echo "$(date): High memory usage: $memory_usage%" >> "$LOG_FILE"
fi

# 檢查任務隊列
queue_size=$(curl -s "$API_URL/monitor/statistics" | jq '.tasks.pending')
if [ "$queue_size" -gt 1000 ]; then
  echo "$(date): Large queue backlog: $queue_size tasks" >> "$LOG_FILE"
fi

# 檢查離線工作者
offline_workers=$(curl -s "$API_URL/monitor/workers/health" | jq '.offline')
if [ "$offline_workers" -gt 0 ]; then
  echo "$(date): Workers offline: $offline_workers" >> "$LOG_FILE"
fi
```

## 災難恢復程序

### 完全系統故障恢復

```bash
#!/bin/bash
# disaster_recovery.sh

echo "開始災難恢復程序..."

# 1. 停止所有服務
docker-compose down
kubectl scale deployment --all --replicas=0 -n finance-strategy

# 2. 恢復資料庫
echo "恢復資料庫..."
gunzip < /backups/latest_backup.sql.gz | \
  psql -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME

# 3. 清理不一致狀態
psql -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME << EOF
-- 重置所有運行中的任務
UPDATE crawler_tasks 
SET status = 'pending', assigned_to = NULL, assigned_at = NULL, started_at = NULL
WHERE status IN ('assigned', 'running');

-- 標記所有工作者為離線
UPDATE crawler_workers SET status = 'offline';

-- 清理過期會話
DELETE FROM sessions WHERE expires_at < NOW();
EOF

# 4. 重啟服務
echo "重啟服務..."
docker-compose up -d
kubectl scale deployment finance-backend --replicas=3 -n finance-strategy
kubectl scale deployment crawler-worker --replicas=5 -n finance-strategy

# 5. 驗證恢復
echo "驗證系統狀態..."
sleep 30

health_check=$(curl -s http://localhost:3000/health)
if echo "$health_check" | jq -e '.status == "healthy"' > /dev/null; then
  echo "✅ 系統恢復成功"
else
  echo "❌ 系統恢復失敗: $health_check"
  exit 1
fi

echo "災難恢復完成"
```

### 部分服務故障恢復

```bash
# 1. 僅重啟後端服務
docker-compose restart backend
kubectl rollout restart deployment/finance-backend -n finance-strategy

# 2. 僅重啟工作者
docker-compose restart crawler-worker
kubectl rollout restart deployment/crawler-worker -n finance-strategy

# 3. 僅重啟資料庫
docker-compose restart postgres
kubectl rollout restart statefulset/postgres -n finance-strategy

# 4. 清理並重啟 Redis
docker-compose stop redis
docker-compose rm -f redis
docker-compose up -d redis
```

## 聯繫和支援

### 緊急聯繫清單

| 角色 | 聯繫方式 | 責任範圍 |
|------|----------|----------|
| **系統管理員** | sysadmin@company.com | 基礎設施和部署 |
| **資料庫管理員** | dba@company.com | 資料庫性能和備份 |
| **開發團隊** | dev-team@company.com | 應用程式錯誤和功能 |
| **監控團隊** | monitoring@company.com | 系統監控和告警 |

### 故障報告模板

```
**故障報告**

時間: 2025-08-16 15:30:00
嚴重程度: [Critical/High/Medium/Low]
影響範圍: [系統範圍]
狀態: [Open/In Progress/Resolved]

**問題描述:**
[詳細描述問題現象]

**重現步驟:**
1. [步驟 1]
2. [步驟 2]
3. [步驟 3]

**預期行為:**
[系統應該如何運作]

**實際行為:**
[實際發生的情況]

**環境資訊:**
- 環境: [Production/Staging/Development]
- 版本: [應用程式版本]
- 瀏覽器: [如適用]

**錯誤日誌:**
[相關錯誤訊息和堆棧跟蹤]

**影響評估:**
[對業務的影響]

**已採取行動:**
[已嘗試的解決方案]

**需要協助:**
[需要什麼支援]
```

## 總結

本故障排除指南提供了全面的問題診斷和解決方案：

✅ **完整診斷工具**: 涵蓋本地、Docker、Kubernetes 環境  
✅ **常見問題解決**: 5大類問題的詳細解決方案  
✅ **錯誤分析**: 日誌分析技巧和錯誤代碼對照  
✅ **性能優化**: 系統資源監控和性能調優  
✅ **預防性維護**: 定期檢查和自動化監控  
✅ **災難恢復**: 完整的恢復程序和最佳實踐  

遵循本指南可有效解決系統問題，確保爬蟲任務管理系統的穩定運行。

---

**指南完成**: 2025-08-16  
**維護者**: DevOps & SRE Team  
**更新頻率**: 根據新問題和解決方案更新  
**下一次審查**: 2025-09-16