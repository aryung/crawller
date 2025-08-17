# 爬蟲任務管理系統測試策略文檔

**版本**: v1.0.0  
**日期**: 2025-08-16  
**作者**: Claude  
**類型**: 測試策略文檔

## 測試概述

本文檔定義了爬蟲任務管理系統的完整測試策略，包括單元測試、整合測試、端到端測試和性能測試。

## 測試目標

### 主要目標
1. **功能正確性**: 確保所有功能按設計運作
2. **系統可靠性**: 驗證錯誤處理和容錯機制
3. **性能達標**: 滿足性能和可擴展性要求
4. **代碼品質**: 維持高測試覆蓋率 (≥80%)

### 測試原則
- **自動化優先**: 所有測試應可自動執行
- **快速反饋**: 單元測試應在秒級完成
- **隔離性**: 測試間相互獨立
- **可重複性**: 測試結果應一致可靠

## 測試架構

### 測試層級

```
┌─────────────────────────────────────────┐
│         E2E Tests (端到端測試)           │
│   完整工作流程測試 (5-10 個測試案例)      │
└─────────────────────────────────────────┘
                    ▲
┌─────────────────────────────────────────┐
│     Integration Tests (整合測試)         │
│   模組間交互測試 (30-50 個測試案例)       │
└─────────────────────────────────────────┘
                    ▲
┌─────────────────────────────────────────┐
│       Unit Tests (單元測試)              │
│   單一函數/類別測試 (200+ 個測試案例)     │
└─────────────────────────────────────────┘
```

### 測試工具鏈

- **測試框架**: Jest
- **Mock 工具**: jest.mock(), @nestjs/testing
- **覆蓋率工具**: Jest Coverage
- **E2E 測試**: Supertest
- **性能測試**: Artillery / K6
- **資料庫測試**: TypeORM Test Utils

## 單元測試策略

### 1. Service 層測試

#### CrawlerTaskService 測試

```typescript
describe('CrawlerTaskService', () => {
  let service: CrawlerTaskService;
  let mockTaskRepository: jest.Mocked<CrawlerTaskRepository>;
  let mockWorkerRepository: jest.Mocked<CrawlerWorkerRepository>;
  let mockAssignmentService: jest.Mocked<TaskAssignmentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerTaskService,
        {
          provide: CrawlerTaskRepository,
          useValue: {
            findAvailableTasks: jest.fn(),
            assignTaskToWorker: jest.fn(),
            updateTaskStatus: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: CrawlerWorkerRepository,
          useValue: {
            findById: jest.fn(),
            updateWorkerLoad: jest.fn(),
          },
        },
        {
          provide: TaskAssignmentService,
          useValue: {
            assignTasks: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CrawlerTaskService>(CrawlerTaskService);
    mockTaskRepository = module.get(CrawlerTaskRepository);
    mockWorkerRepository = module.get(CrawlerWorkerRepository);
    mockAssignmentService = module.get(TaskAssignmentService);
  });

  describe('requestTasks', () => {
    it('應該成功分配任務給工作者', async () => {
      // Arrange
      const workerId = 'worker-1';
      const mockTasks = [
        { id: 'task-1', status: TaskStatus.PENDING },
        { id: 'task-2', status: TaskStatus.PENDING },
      ];
      const mockWorker = { id: workerId, status: WorkerStatus.ONLINE };

      mockWorkerRepository.findById.mockResolvedValue(mockWorker);
      mockTaskRepository.findAvailableTasks.mockResolvedValue(mockTasks);
      mockAssignmentService.assignTasks.mockResolvedValue([
        { workerId, assignedTasks: ['task-1', 'task-2'] },
      ]);

      // Act
      const result = await service.requestTasks(workerId, {
        supported_regions: [ExchangeArea.TW],
        supported_data_types: [DataType.DAILY],
        limit: 2,
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(mockWorkerRepository.findById).toHaveBeenCalledWith(workerId);
      expect(mockTaskRepository.findAvailableTasks).toHaveBeenCalled();
      expect(mockAssignmentService.assignTasks).toHaveBeenCalled();
    });

    it('應該拒絕離線工作者的請求', async () => {
      // Arrange
      const workerId = 'offline-worker';
      mockWorkerRepository.findById.mockResolvedValue({
        id: workerId,
        status: WorkerStatus.OFFLINE,
      });

      // Act & Assert
      await expect(
        service.requestTasks(workerId, {
          supported_regions: [ExchangeArea.TW],
          supported_data_types: [DataType.DAILY],
        })
      ).rejects.toThrow('Worker is offline');
    });

    it('應該處理無可用任務的情況', async () => {
      // Arrange
      const workerId = 'worker-1';
      mockWorkerRepository.findById.mockResolvedValue({
        id: workerId,
        status: WorkerStatus.ONLINE,
      });
      mockTaskRepository.findAvailableTasks.mockResolvedValue([]);

      // Act
      const result = await service.requestTasks(workerId, {
        supported_regions: [ExchangeArea.TW],
        supported_data_types: [DataType.DAILY],
      });

      // Assert
      expect(result).toHaveLength(0);
      expect(mockAssignmentService.assignTasks).not.toHaveBeenCalled();
    });
  });

  describe('reportExecutionResult', () => {
    it('應該正確記錄成功執行結果', async () => {
      // Arrange
      const workerId = 'worker-1';
      const taskId = 'task-1';
      const mockTask = {
        id: taskId,
        assigned_to: workerId,
        status: TaskStatus.RUNNING,
      };
      const executionResult = {
        task_id: taskId,
        status: HistoryStatus.SUCCESS,
        records_fetched: 100,
        records_saved: 100,
        execution_time_ms: 5000,
      };

      mockTaskRepository.findById.mockResolvedValue(mockTask);

      // Act
      await service.reportExecutionResult(workerId, executionResult);

      // Assert
      expect(mockTaskRepository.updateTaskStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.COMPLETED
      );
      expect(mockHistoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          task_id: taskId,
          worker_id: workerId,
          status: HistoryStatus.SUCCESS,
        })
      );
    });

    it('應該正確處理失敗結果和重試邏輯', async () => {
      // Arrange
      const workerId = 'worker-1';
      const taskId = 'task-1';
      const mockTask = {
        id: taskId,
        assigned_to: workerId,
        status: TaskStatus.RUNNING,
        retry_count: 1,
        max_retries: 3,
      };
      const executionResult = {
        task_id: taskId,
        status: HistoryStatus.FAILED,
        error: {
          category: FailureCategory.NETWORK,
          reason: FailureReason.CONNECTION_TIMEOUT,
          message: 'Connection timeout',
        },
      };

      mockTaskRepository.findById.mockResolvedValue(mockTask);

      // Act
      await service.reportExecutionResult(workerId, executionResult);

      // Assert
      expect(mockTaskRepository.updateTaskStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.PENDING // 應該重置為 PENDING 以便重試
      );
      expect(mockFailureRepository.create).toHaveBeenCalled();
    });
  });
});
```

#### TaskAssignmentService 測試

```typescript
describe('TaskAssignmentService', () => {
  let service: TaskAssignmentService;

  beforeEach(() => {
    service = new TaskAssignmentService(
      mockWorkerRepository,
      mockTaskRepository
    );
  });

  describe('calculateAssignmentScore', () => {
    it('應該正確計算分配分數', () => {
      // Arrange
      const worker: WorkerCapability = {
        workerId: 'worker-1',
        loadRatio: 0.3,
        availableSlots: 3,
        performance: {
          successRate: 0.95,
          qualityScore: 0.9,
          avgExecutionTime: 30000,
        },
        lastHeartbeat: new Date(),
      };
      const task = { priority: 8 } as CrawlerTask;

      // Act
      const score = service['calculateAssignmentScore'](worker, task, []);

      // Assert
      expect(score).toBeGreaterThan(80);
      expect(score).toBeLessThan(100);
    });

    it('應該偏好低負載工作者', () => {
      // Arrange
      const lowLoadWorker: WorkerCapability = {
        workerId: 'worker-1',
        loadRatio: 0.2,
        availableSlots: 4,
        performance: { successRate: 0.9, qualityScore: 0.9, avgExecutionTime: 30000 },
        lastHeartbeat: new Date(),
      };
      const highLoadWorker: WorkerCapability = {
        workerId: 'worker-2',
        loadRatio: 0.8,
        availableSlots: 1,
        performance: { successRate: 0.9, qualityScore: 0.9, avgExecutionTime: 30000 },
        lastHeartbeat: new Date(),
      };
      const task = { priority: 5 } as CrawlerTask;

      // Act
      const lowLoadScore = service['calculateAssignmentScore'](lowLoadWorker, task, []);
      const highLoadScore = service['calculateAssignmentScore'](highLoadWorker, task, []);

      // Assert
      expect(lowLoadScore).toBeGreaterThan(highLoadScore);
    });
  });

  describe('checkLoadBalance', () => {
    it('應該正確檢測負載不平衡', async () => {
      // Arrange
      const workers = [
        { workerId: 'worker-1', loadRatio: 0.9 },
        { workerId: 'worker-2', loadRatio: 0.1 },
      ];
      jest.spyOn(service, 'getWorkerCapabilities').mockResolvedValue(workers);

      // Act
      const result = await service.checkLoadBalance();

      // Assert
      expect(result.isBalanced).toBe(false);
      expect(result.loadVariance).toBeGreaterThan(0.15);
      expect(result.recommendations).toContain(
        expect.stringContaining('負載不均')
      );
    });
  });
});
```

### 2. Repository 層測試

```typescript
describe('CrawlerTaskRepository', () => {
  let repository: CrawlerTaskRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    // 設置測試資料庫
    dataSource = await createTestDataSource();
    repository = new CrawlerTaskRepository(dataSource);
  });

  afterEach(async () => {
    // 清理測試數據
    await dataSource.getRepository(CrawlerTask).clear();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('findAvailableTasks', () => {
    it('應該找到符合條件的待處理任務', async () => {
      // Arrange
      await dataSource.getRepository(CrawlerTask).save([
        {
          symbol_code: '2330',
          exchange_area: ExchangeArea.TW,
          data_type: DataType.DAILY,
          status: TaskStatus.PENDING,
          priority: 8,
        },
        {
          symbol_code: 'AAPL',
          exchange_area: ExchangeArea.US,
          data_type: DataType.QUARTERLY,
          status: TaskStatus.PENDING,
          priority: 5,
        },
        {
          symbol_code: '2317',
          exchange_area: ExchangeArea.TW,
          data_type: DataType.DAILY,
          status: TaskStatus.RUNNING, // 不應被選中
          priority: 10,
        },
      ]);

      // Act
      const tasks = await repository.findAvailableTasks(
        [ExchangeArea.TW],
        [DataType.DAILY],
        10
      );

      // Assert
      expect(tasks).toHaveLength(1);
      expect(tasks[0].symbol_code).toBe('2330');
    });

    it('應該按優先級和創建時間排序', async () => {
      // Arrange
      const now = new Date();
      await dataSource.getRepository(CrawlerTask).save([
        {
          symbol_code: 'A',
          exchange_area: ExchangeArea.TW,
          data_type: DataType.DAILY,
          status: TaskStatus.PENDING,
          priority: 5,
          created_at: new Date(now.getTime() - 1000),
        },
        {
          symbol_code: 'B',
          exchange_area: ExchangeArea.TW,
          data_type: DataType.DAILY,
          status: TaskStatus.PENDING,
          priority: 8,
          created_at: new Date(now.getTime() - 2000),
        },
        {
          symbol_code: 'C',
          exchange_area: ExchangeArea.TW,
          data_type: DataType.DAILY,
          status: TaskStatus.PENDING,
          priority: 8,
          created_at: new Date(now.getTime() - 3000),
        },
      ]);

      // Act
      const tasks = await repository.findAvailableTasks(
        [ExchangeArea.TW],
        [DataType.DAILY],
        10
      );

      // Assert
      expect(tasks[0].symbol_code).toBe('C'); // 優先級 8, 最早創建
      expect(tasks[1].symbol_code).toBe('B'); // 優先級 8, 較晚創建
      expect(tasks[2].symbol_code).toBe('A'); // 優先級 5
    });
  });

  describe('findOverdueTasks', () => {
    it('應該找到超時的任務', async () => {
      // Arrange
      const now = new Date();
      const overdueTime = new Date(now.getTime() - 11 * 60 * 1000); // 11分鐘前

      await dataSource.getRepository(CrawlerTask).save([
        {
          symbol_code: 'TIMEOUT',
          status: TaskStatus.RUNNING,
          assigned_at: overdueTime,
          timeout_seconds: 600, // 10分鐘超時
        },
        {
          symbol_code: 'NORMAL',
          status: TaskStatus.RUNNING,
          assigned_at: now,
          timeout_seconds: 600,
        },
      ]);

      // Act
      const overdueTasks = await repository.findOverdueTasks(10);

      // Assert
      expect(overdueTasks).toHaveLength(1);
      expect(overdueTasks[0].symbol_code).toBe('TIMEOUT');
    });
  });
});
```

### 3. Controller 層測試

```typescript
describe('CrawlerTaskController', () => {
  let app: INestApplication;
  let crawlerTaskService: CrawlerTaskService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CrawlerModule],
    })
      .overrideProvider(CrawlerTaskService)
      .useValue({
        registerWorker: jest.fn(),
        updateHeartbeat: jest.fn(),
        requestTasks: jest.fn(),
        updateTaskStatus: jest.fn(),
        reportExecutionResult: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    crawlerTaskService = moduleFixture.get<CrawlerTaskService>(CrawlerTaskService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /workers/register', () => {
    it('應該成功註冊工作者', async () => {
      // Arrange
      const registrationDto = {
        id: 'test-worker',
        name: 'Test Worker',
        supported_regions: [ExchangeArea.TW],
        supported_data_types: [DataType.DAILY],
        max_concurrent_tasks: 3,
      };

      jest.spyOn(crawlerTaskService, 'registerWorker').mockResolvedValue({
        id: 'test-worker',
        status: WorkerStatus.ONLINE,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/workers/register')
        .send(registrationDto)
        .expect(201);

      expect(response.body).toHaveProperty('id', 'test-worker');
      expect(crawlerTaskService.registerWorker).toHaveBeenCalledWith(registrationDto);
    });

    it('應該驗證必填欄位', async () => {
      // Arrange
      const invalidDto = {
        name: 'Test Worker',
        // 缺少 id
      };

      // Act & Assert
      await request(app.getHttpServer())
        .post('/workers/register')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('POST /workers/:workerId/request-tasks', () => {
    it('應該返回分配的任務', async () => {
      // Arrange
      const workerId = 'test-worker';
      const requestDto = {
        supported_regions: [ExchangeArea.TW],
        supported_data_types: [DataType.DAILY],
        limit: 2,
      };

      const mockTasks = [
        { id: 'task-1', symbol_code: '2330' },
        { id: 'task-2', symbol_code: '2317' },
      ];

      jest.spyOn(crawlerTaskService, 'requestTasks').mockResolvedValue(mockTasks);

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post(`/workers/${workerId}/request-tasks`)
        .send(requestDto)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(crawlerTaskService.requestTasks).toHaveBeenCalledWith(workerId, requestDto);
    });
  });

  describe('PUT /workers/:workerId/heartbeat', () => {
    it('應該更新工作者心跳', async () => {
      // Arrange
      const workerId = 'test-worker';
      const heartbeatDto = {
        current_load: 2,
        memory_usage_mb: 512,
        cpu_usage_percent: 45,
      };

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/workers/${workerId}/heartbeat`)
        .send(heartbeatDto)
        .expect(200);

      expect(crawlerTaskService.updateHeartbeat).toHaveBeenCalledWith(workerId, heartbeatDto);
    });
  });
});
```

## 整合測試策略

### 1. 任務生命週期整合測試

```typescript
describe('Task Lifecycle Integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // 設置完整的測試環境
    const moduleFixture = await Test.createTestingModule({
      imports: [
        CrawlerModule,
        TypeOrmModule.forRoot(testDbConfig),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
    await dataSource.destroy();
  });

  it('應該完成完整的任務執行流程', async () => {
    // 1. 註冊工作者
    const workerRegistration = await request(app.getHttpServer())
      .post('/workers/register')
      .send({
        id: 'integration-worker',
        name: 'Integration Test Worker',
        supported_regions: [ExchangeArea.TW],
        supported_data_types: [DataType.DAILY],
      })
      .expect(201);

    const workerId = workerRegistration.body.id;

    // 2. 創建任務
    const taskCreation = await request(app.getHttpServer())
      .post('/tasks')
      .send({
        symbol_code: '2330',
        exchange_area: ExchangeArea.TW,
        data_type: DataType.DAILY,
        priority: 8,
      })
      .expect(201);

    const taskId = taskCreation.body.id;

    // 3. 工作者請求任務
    const taskRequest = await request(app.getHttpServer())
      .post(`/workers/${workerId}/request-tasks`)
      .send({
        supported_regions: [ExchangeArea.TW],
        supported_data_types: [DataType.DAILY],
        limit: 1,
      })
      .expect(200);

    expect(taskRequest.body).toHaveLength(1);
    expect(taskRequest.body[0].id).toBe(taskId);

    // 4. 更新任務狀態為運行中
    await request(app.getHttpServer())
      .put(`/workers/${workerId}/tasks/${taskId}/status`)
      .send({ status: TaskStatus.RUNNING })
      .expect(200);

    // 5. 回報執行結果
    await request(app.getHttpServer())
      .post(`/workers/${workerId}/report-result`)
      .send({
        task_id: taskId,
        status: HistoryStatus.SUCCESS,
        records_fetched: 100,
        records_saved: 100,
        execution_time_ms: 5000,
      })
      .expect(200);

    // 6. 驗證最終狀態
    const finalTask = await dataSource
      .getRepository(CrawlerTask)
      .findOne({ where: { id: taskId } });

    expect(finalTask.status).toBe(TaskStatus.COMPLETED);
    expect(finalTask.completed_at).toBeDefined();
  });
});
```

### 2. 調度器整合測試

```typescript
describe('Scheduler Integration', () => {
  let schedulerService: CrawlerSchedulerService;
  let taskRepository: CrawlerTaskRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [CrawlerModule, ScheduleModule.forRoot()],
    }).compile();

    schedulerService = module.get<CrawlerSchedulerService>(CrawlerSchedulerService);
    taskRepository = module.get<CrawlerTaskRepository>(CrawlerTaskRepository);
  });

  it('應該正確執行任務隊列維護', async () => {
    // Arrange
    // 創建一些超時和待處理的任務
    await taskRepository.save([
      {
        symbol_code: 'TIMEOUT',
        status: TaskStatus.RUNNING,
        assigned_at: new Date(Date.now() - 20 * 60 * 1000), // 20分鐘前
        timeout_seconds: 600,
      },
      {
        symbol_code: 'PENDING',
        status: TaskStatus.PENDING,
        priority: 8,
      },
    ]);

    // Act
    const statistics = await schedulerService.maintainTaskQueue();

    // Assert
    expect(statistics.tasksProcessed).toBeGreaterThan(0);
    expect(statistics.queueMaintenanceActions).toContain(
      expect.stringContaining('超時任務')
    );

    // 驗證超時任務被處理
    const timeoutTask = await taskRepository.findOne({
      where: { symbol_code: 'TIMEOUT' },
    });
    expect(timeoutTask.status).toBe(TaskStatus.TIMEOUT);
  });
});
```

## 端到端測試策略

### 1. 完整工作流程 E2E 測試

```typescript
describe('E2E: Complete Crawler Workflow', () => {
  let app: INestApplication;
  let workerClient: CrawlerWorkerClient;

  beforeAll(async () => {
    // 啟動後端服務
    app = await bootstrapTestApp();

    // 啟動工作者客戶端
    workerClient = new CrawlerWorkerClient({
      workerId: 'e2e-worker',
      workerName: 'E2E Test Worker',
      apiBaseUrl: 'http://localhost:3000',
      supportedRegions: [ExchangeArea.TW],
      supportedDataTypes: [DataType.DAILY],
    });
  });

  afterAll(async () => {
    await workerClient.stop();
    await app.close();
  });

  it('應該完成從任務創建到執行完成的完整流程', async (done) => {
    // 1. 啟動工作者
    await workerClient.start();

    // 2. 監聽任務完成事件
    workerClient.on('taskCompleted', (data) => {
      expect(data.result.success).toBe(true);
      done();
    });

    // 3. 創建任務
    await request(app.getHttpServer())
      .post('/tasks')
      .send({
        symbol_code: '2330',
        exchange_area: ExchangeArea.TW,
        data_type: DataType.DAILY,
        priority: 10,
        config_file_path: 'test-config.json',
      })
      .expect(201);

    // 工作者應該自動請求並執行任務
  }, 30000); // 30秒超時
});
```

## 性能測試策略

### 1. 負載測試

```yaml
# artillery-load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up"
    - duration: 300
      arrivalRate: 100
      name: "Sustained load"
  processor: "./load-test-processor.js"

scenarios:
  - name: "Worker Task Request Cycle"
    flow:
      - post:
          url: "/workers/register"
          json:
            id: "{{ $randomString() }}"
            name: "Load Test Worker {{ $randomNumber() }}"
            supported_regions: ["TW"]
            supported_data_types: ["DAILY"]
      - loop:
        - post:
            url: "/workers/{{ id }}/request-tasks"
            json:
              supported_regions: ["TW"]
              supported_data_types: ["DAILY"]
              limit: 5
        - think: 5
        count: 20
```

### 2. 並發測試

```typescript
describe('Concurrency Performance', () => {
  it('應該處理多個工作者並發請求', async () => {
    const workerCount = 10;
    const tasksPerWorker = 5;

    // 創建多個工作者
    const workers = Array.from({ length: workerCount }, (_, i) => ({
      id: `perf-worker-${i}`,
      name: `Performance Worker ${i}`,
    }));

    // 並發註冊工作者
    await Promise.all(
      workers.map(worker =>
        request(app.getHttpServer())
          .post('/workers/register')
          .send(worker)
      )
    );

    // 創建足夠的任務
    const tasks = Array.from({ length: workerCount * tasksPerWorker }, (_, i) => ({
      symbol_code: `TEST${i}`,
      exchange_area: ExchangeArea.TW,
      data_type: DataType.DAILY,
    }));

    await Promise.all(
      tasks.map(task =>
        request(app.getHttpServer())
          .post('/tasks')
          .send(task)
      )
    );

    // 測量並發請求性能
    const startTime = Date.now();

    const requestPromises = workers.map(worker =>
      request(app.getHttpServer())
        .post(`/workers/${worker.id}/request-tasks`)
        .send({
          supported_regions: [ExchangeArea.TW],
          supported_data_types: [DataType.DAILY],
          limit: tasksPerWorker,
        })
    );

    const results = await Promise.all(requestPromises);
    const duration = Date.now() - startTime;

    // 驗證性能指標
    expect(duration).toBeLessThan(5000); // 5秒內完成
    results.forEach(result => {
      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(tasksPerWorker);
    });

    // 計算吞吐量
    const throughput = (workerCount * tasksPerWorker) / (duration / 1000);
    console.log(`Throughput: ${throughput.toFixed(2)} tasks/second`);
    expect(throughput).toBeGreaterThan(10); // 至少 10 tasks/second
  });
});
```

## 測試資料管理

### 1. 測試資料工廠

```typescript
// test/factories/task.factory.ts
export class TaskFactory {
  static createPendingTask(overrides?: Partial<CrawlerTask>): CrawlerTask {
    return {
      id: faker.datatype.uuid(),
      symbol_code: faker.random.alphaNumeric(4).toUpperCase(),
      exchange_area: faker.random.arrayElement([ExchangeArea.TW, ExchangeArea.US, ExchangeArea.JP]),
      data_type: faker.random.arrayElement([DataType.DAILY, DataType.QUARTERLY]),
      status: TaskStatus.PENDING,
      priority: faker.datatype.number({ min: 1, max: 10 }),
      is_active: true,
      retry_count: 0,
      max_retries: 3,
      timeout_seconds: 300,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  static createBatch(count: number, overrides?: Partial<CrawlerTask>): CrawlerTask[] {
    return Array.from({ length: count }, () => this.createPendingTask(overrides));
  }
}

// test/factories/worker.factory.ts
export class WorkerFactory {
  static createOnlineWorker(overrides?: Partial<CrawlerWorker>): CrawlerWorker {
    return {
      id: `worker-${faker.datatype.uuid()}`,
      name: faker.name.firstName() + ' Worker',
      status: WorkerStatus.ONLINE,
      supported_regions: [ExchangeArea.TW],
      supported_data_types: [DataType.DAILY, DataType.QUARTERLY],
      max_concurrent_tasks: 3,
      current_load: 0,
      last_heartbeat: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }
}
```

### 2. 測試資料庫設置

```typescript
// test/setup/database.setup.ts
export async function createTestDataSource(): Promise<DataSource> {
  return new DataSource({
    type: 'sqlite',
    database: ':memory:',
    dropSchema: true,
    entities: [CrawlerTask, CrawlerWorker, CrawlerHistory, CrawlerFailure],
    synchronize: true,
    logging: false,
  });
}

export async function seedTestData(dataSource: DataSource): Promise<void> {
  const taskRepository = dataSource.getRepository(CrawlerTask);
  const workerRepository = dataSource.getRepository(CrawlerWorker);

  // 創建測試工作者
  await workerRepository.save([
    WorkerFactory.createOnlineWorker({ id: 'test-worker-1' }),
    WorkerFactory.createOnlineWorker({ id: 'test-worker-2' }),
  ]);

  // 創建測試任務
  await taskRepository.save([
    ...TaskFactory.createBatch(10, { exchange_area: ExchangeArea.TW }),
    ...TaskFactory.createBatch(5, { exchange_area: ExchangeArea.US }),
  ]);
}

export async function cleanupTestData(dataSource: DataSource): Promise<void> {
  const entities = dataSource.entityMetadatas;
  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.clear();
  }
}
```

## 測試覆蓋率要求

### 覆蓋率目標

| 類別 | 目標覆蓋率 | 最低要求 |
|------|-----------|---------|
| **語句覆蓋率** | 85% | 80% |
| **分支覆蓋率** | 80% | 75% |
| **函數覆蓋率** | 90% | 85% |
| **行覆蓋率** | 85% | 80% |

### 覆蓋率配置

```json
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 85,
      lines: 80,
      statements: 80,
    },
    './src/crawler/services/': {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '.spec.ts',
    '.interface.ts',
    '.dto.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
    '!src/main.ts',
  ],
};
```

## 持續整合測試

### GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: crawler_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run lint
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test:cov
        env:
          DATABASE_HOST: localhost
          DATABASE_PORT: 5432
          DATABASE_USERNAME: postgres
          DATABASE_PASSWORD: test
          DATABASE_NAME: crawler_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          fail_ci_if_error: true
```

## 測試執行指南

### 本地測試執行

```bash
# 執行所有測試
npm run test

# 執行特定測試檔案
npm run test -- crawler-task.service.spec.ts

# 執行特定測試套件
npm run test -- --testNamePattern="CrawlerTaskService"

# 執行測試並生成覆蓋率報告
npm run test:cov

# 監控模式執行測試
npm run test:watch

# 執行整合測試
npm run test:integration

# 執行 E2E 測試
npm run test:e2e

# 執行性能測試
npm run test:performance
```

### 測試調試

```bash
# 使用 VSCode 調試測試
# 在 .vscode/launch.json 添加配置
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "--runInBand",
    "--no-cache",
    "--watchAll=false",
    "${fileBasenameNoExtension}"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}

# 使用 Chrome DevTools 調試
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

## 測試最佳實踐

### 1. 測試命名規範

```typescript
// ✅ 好的測試命名
describe('CrawlerTaskService', () => {
  describe('requestTasks', () => {
    it('應該成功分配任務給線上工作者', () => {});
    it('應該拒絕離線工作者的請求', () => {});
    it('當沒有可用任務時應該返回空陣列', () => {});
  });
});

// ❌ 不好的測試命名
describe('Service', () => {
  it('test1', () => {});
  it('works', () => {});
});
```

### 2. 測試隔離

```typescript
// ✅ 好的做法：每個測試獨立
beforeEach(() => {
  // 重置 mock
  jest.clearAllMocks();
  // 重置資料庫
  await cleanupTestData();
});

// ❌ 不好的做法：測試間有依賴
it('test1', () => {
  globalVar = 'something';
});

it('test2', () => {
  expect(globalVar).toBe('something'); // 依賴 test1
});
```

### 3. 測試資料管理

```typescript
// ✅ 使用 Factory 模式
const task = TaskFactory.createPendingTask({
  symbol_code: '2330',
  priority: 10,
});

// ❌ 硬編碼測試資料
const task = {
  id: '123',
  symbol_code: '2330',
  exchange_area: 'TW',
  data_type: 'DAILY',
  // ... 很多其他欄位
};
```

## 總結

本測試策略確保了爬蟲任務管理系統的：

✅ **功能正確性**: 通過單元和整合測試驗證  
✅ **系統可靠性**: 通過 E2E 測試和錯誤場景測試  
✅ **性能達標**: 通過負載和並發測試  
✅ **代碼品質**: 通過覆蓋率要求和 CI/CD 整合  
✅ **可維護性**: 通過清晰的測試結構和最佳實踐  

測試金字塔確保了快速反饋和全面覆蓋，為系統的穩定運行提供了堅實保障。

---

**測試策略完成**: 2025-08-16  
**策略制定者**: Claude  
**執行狀態**: 待實施測試案例  
**預期覆蓋率**: ≥80%