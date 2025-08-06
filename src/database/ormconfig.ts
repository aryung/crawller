import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { FundamentalDataEntity } from './entities/FundamentalDataEntity.js';

// Load environment variables
config();

// Database connection configuration following finance-strategy pattern
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_DB_IP || 'localhost',
  port: parseInt(process.env.POSTGRES_DB_PORT || '5432'),
  username: process.env.POSTGRES_DB_USER,
  password: process.env.POSTGRES_DB_PASSWORD,
  database:
    process.env.NODE_ENV === 'production'
      ? process.env.POSTGRES_DB_NAME_AHA
      : process.env.POSTGRES_DB_NAME_AHA_DEV,
  entities: [FundamentalDataEntity],
  synchronize: false, // Never use synchronize in production
  logging: process.env.NODE_ENV === 'development',
  logger: 'advanced-console',
  extra: {
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
  },
});

// Initialize connection
export async function initializeDatabase(): Promise<DataSource> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ Database connection established');
    }
    return AppDataSource;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Close connection
export async function closeDatabase(): Promise<void> {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Database connection closed');
    }
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw error;
  }
}