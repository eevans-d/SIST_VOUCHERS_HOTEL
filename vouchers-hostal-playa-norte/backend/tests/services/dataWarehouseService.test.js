import DataWarehouseService from '../../src/services/dataWarehouseService.js';

describe('DataWarehouseService', () => {
  let service;

  beforeEach(() => {
    service = new DataWarehouseService({ provider: 'local' });
  });

  describe('Initialization', () => {
    it('should initialize with local provider', () => {
      expect(service.warehouse.type).toBe('local');
      expect(service.warehouse.connected).toBe(true);
    });

    it('should initialize with BigQuery provider', () => {
      const bq = new DataWarehouseService({ provider: 'bigquery' });
      expect(bq.warehouse.type).toBe('bigquery');
    });

    it('should initialize with Redshift provider', () => {
      const rs = new DataWarehouseService({ provider: 'redshift' });
      expect(rs.warehouse.type).toBe('redshift');
    });
  });

  describe('Data Sources', () => {
    it('should register data source', () => {
      const source = service.registerDataSource('bookings', {
        type: 'database',
        connection: {},
        tables: ['bookings', 'rooms']
      });

      expect(source.name).toBe('bookings');
      expect(source.type).toBe('database');
    });

    it('should list data sources', () => {
      service.registerDataSource('source1', { type: 'database' });
      service.registerDataSource('source2', { type: 'api' });
      
      const sources = service.listDataSources();
      expect(sources.length).toBe(2);
    });
  });

  describe('ETL Pipelines', () => {
    it('should create pipeline', () => {
      const pipeline = service.createPipeline('daily_sync', {
        source: 'bookings',
        destination: 'warehouse',
        transformations: [],
        schedule: 'daily'
      });

      expect(pipeline.name).toBe('daily_sync');
      expect(pipeline.enabled).toBe(true);
    });

    it('should execute pipeline', async () => {
      service.registerDataSource('test', {
        type: 'database',
        connection: {},
        tables: ['test']
      });

      const pipeline = service.createPipeline('test_pipeline', {
        source: 'test',
        transformations: []
      });

      const result = await service.executePipeline(pipeline.id);
      
      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBeGreaterThanOrEqual(0);
    });

    it('should track pipeline stats', async () => {
      service.registerDataSource('test', { type: 'database' });
      const pipeline = service.createPipeline('test', { source: 'test' });

      await service.executePipeline(pipeline.id);

      const stats = service.getPipelineStats(pipeline.id);
      expect(stats.totalRuns).toBe(1);
      expect(stats.successRuns).toBe(1);
    });

    it('should list pipelines', () => {
      service.createPipeline('p1', { source: 's1' });
      service.createPipeline('p2', { source: 's2' });

      const pipelines = service.listPipelines();
      expect(pipelines.length).toBe(2);
    });

    it('should start pipeline', () => {
      const pipeline = service.createPipeline('test', {
        source: 'test',
        enabled: false
      });

      service.startPipeline(pipeline.id);
      expect(pipeline.enabled).toBe(true);
    });

    it('should stop pipeline', () => {
      const pipeline = service.createPipeline('test', { source: 'test' });
      
      service.stopPipeline(pipeline.id);
      expect(pipeline.enabled).toBe(false);
    });
  });

  describe('Transformations', () => {
    it('should apply map transformation', async () => {
      const data = [{ price: 100 }, { price: 200 }];
      const transformed = await service.applyTransformation(data, {
        type: 'map',
        function: (item) => ({ ...item, priceWithTax: item.price * 1.1 })
      });

      // Tolerar precisión de punto flotante
      expect(transformed[0].priceWithTax).toBeCloseTo(110, 6);
    });

    it('should apply filter transformation', async () => {
      const data = [{ price: 100 }, { price: 200 }, { price: 50 }];
      const transformed = await service.applyTransformation(data, {
        type: 'filter',
        function: (item) => item.price > 75
      });

      expect(transformed.length).toBe(2);
    });

    it('should apply aggregate transformation', async () => {
      const data = [
        { room: 'A', price: 100 },
        { room: 'A', price: 150 },
        { room: 'B', price: 200 }
      ];

      const transformed = await service.applyTransformation(data, {
        type: 'aggregate',
        groupBy: 'room',
        aggregations: [
          { column: 'price', function: 'sum' },
          { column: 'price', function: 'avg' }
        ]
      });

      expect(transformed.length).toBe(2);
      expect(transformed[0].price_sum).toBeDefined();
    });

    it('should apply deduplicate transformation', async () => {
      const data = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'A' }
      ];

      const transformed = await service.applyTransformation(data, {
        type: 'deduplicate',
        key: 'id'
      });

      expect(transformed.length).toBe(2);
    });

    it('should apply join transformation', async () => {
      const data1 = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' }
      ];
      const data2 = [
        { id: 1, price: 100 },
        { id: 2, price: 200 }
      ];

      const transformed = await service.applyTransformation(data1, {
        type: 'join',
        joinData: data2,
        joinKey: 'id'
      });

      expect(transformed[0].price).toBe(100);
    });
  });

  describe('Aggregations', () => {
    it('should create aggregation', () => {
      const agg = service.createAggregation('daily_revenue', {
        sourceTable: 'bookings',
        targetTable: 'agg_daily_revenue',
        dimensions: ['date', 'roomType'],
        metrics: [
          { column: 'price', aggregation: 'sum', name: 'total_revenue' }
        ]
      });

      expect(agg.name).toBe('daily_revenue');
    });

    it('should execute aggregation', async () => {
      // Insert test data
      await service.warehouse.insert('bookings', [
        { date: '2024-01-15', roomType: 'suite', price: 200 },
        { date: '2024-01-15', roomType: 'suite', price: 250 },
        { date: '2024-01-15', roomType: 'deluxe', price: 300 }
      ]);

      const agg = service.createAggregation('test_agg', {
        sourceTable: 'bookings',
        dimensions: ['date', 'roomType'],
        metrics: [
          { column: 'price', aggregation: 'sum' }
        ]
      });

      const result = await service.executeAggregation(agg.id);
      expect(result.recordsCreated).toBeGreaterThan(0);
    });

    it('should group by dimensions', () => {
      const data = [
        { date: '2024-01-15', room: 'A', price: 100 },
        { date: '2024-01-15', room: 'B', price: 200 },
        { date: '2024-01-16', room: 'A', price: 150 }
      ];

      const grouped = service.groupByDimensions(data, ['date', 'room']);
      expect(grouped.length).toBe(3);
    });

    it('should calculate metrics', () => {
      const groups = [
        {
          dimensions: { date: '2024-01-15' },
          records: [{ price: 100 }, { price: 200 }, { price: 300 }]
        }
      ];

      const metrics = [
        { column: 'price', aggregation: 'sum' },
        { column: 'price', aggregation: 'avg' }
      ];

      const result = service.calculateMetrics(groups, metrics);
      expect(result[0].price_sum).toBe(600);
      expect(result[0].price_avg).toBe(200);
    });
  });

  describe('Data Loading', () => {
    it('should load data to warehouse', async () => {
      const data = [
        { id: 1, value: 'A' },
        { id: 2, value: 'B' }
      ];

      const result = await service.load(data, 'test_table');
      expect(result).toBe(true);
    });

    it('should batch insert large datasets', async () => {
      const data = Array.from({ length: 5000 }, (_, i) => ({ id: i }));
      const result = await service.load(data, 'test_table');
      expect(result).toBe(true);
    });
  });

  describe('Queries', () => {
    it('should execute query', async () => {
      const result = await service.query('SELECT * FROM bookings');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should get statistics', () => {
      service.registerDataSource('s1', { type: 'database' });
      service.createPipeline('p1', { source: 's1' });

      const stats = service.getStatistics();
      expect(stats.provider).toBe('local');
      expect(stats.dataSources).toBe(1);
      expect(stats.pipelines).toBe(1);
    });
  });

  describe('Health Check', () => {
    it('should report healthy status', () => {
      const health = service.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.connected).toBe(true);
    });
  });
});
