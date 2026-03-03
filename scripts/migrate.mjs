/**
 * Database Migration Script
 * Run: node scripts/migrate.mjs
 * 
 * Creates all required tables for the VSL Dashboard.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Please configure your .env file.');
  process.exit(1);
}

const MIGRATIONS = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    openId VARCHAR(64) NOT NULL UNIQUE,
    name TEXT,
    email VARCHAR(320),
    loginMethod VARCHAR(64),
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // VSLs table
  `CREATE TABLE IF NOT EXISTS vsls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    normalizedName VARCHAR(255) NOT NULL,
    groupName VARCHAR(255),
    product VARCHAR(255),
    vturbPlayerId VARCHAR(255),
    redtrackLandingId VARCHAR(255),
    redtrackLandingName VARCHAR(255),
    isActive INT NOT NULL DEFAULT 1,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // VSL Performance Data table
  `CREATE TABLE IF NOT EXISTS vsl_performance_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vslId INT NOT NULL,
    date DATE NOT NULL,
    revenue DECIMAL(12,2) DEFAULT 0,
    cost DECIMAL(12,2) DEFAULT 0,
    profit DECIMAL(12,2) DEFAULT 0,
    clicks INT DEFAULT 0,
    conversions INT DEFAULT 0,
    impressions INT DEFAULT 0,
    lpViews INT DEFAULT 0,
    lpClicks INT DEFAULT 0,
    presellViews INT DEFAULT 0,
    presellClicks INT DEFAULT 0,
    initiateCheckouts INT DEFAULT 0,
    purchases INT DEFAULT 0,
    totalPlays INT DEFAULT 0,
    uniquePlays INT DEFAULT 0,
    watchRate DECIMAL(5,2) DEFAULT 0,
    avgWatchTime INT DEFAULT 0,
    retentionData JSON,
    quartile25 INT DEFAULT 0,
    quartile50 INT DEFAULT 0,
    quartile75 INT DEFAULT 0,
    quartile100 INT DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX vsl_date_idx (vslId, date)
  )`,

  // API Sync Log table
  `CREATE TABLE IF NOT EXISTS api_sync_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    syncType VARCHAR(100) NOT NULL,
    status ENUM('pending', 'running', 'success', 'error') NOT NULL DEFAULT 'pending',
    dateFrom DATE,
    dateTo DATE,
    recordsProcessed INT DEFAULT 0,
    errorMessage TEXT,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP
  )`,

  // API Settings table
  `CREATE TABLE IF NOT EXISTS api_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    settingKey VARCHAR(100) NOT NULL UNIQUE,
    settingValue TEXT,
    description VARCHAR(500),
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Create default admin user (standalone mode)
  `INSERT IGNORE INTO users (openId, name, role) VALUES ('admin', 'Admin', 'admin')`,
];

async function runMigrations() {
  console.log('🔄 Connecting to database...');
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  console.log('✅ Connected successfully!');
  console.log('🔄 Running migrations...\n');

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const sql = MIGRATIONS[i];
    const preview = sql.substring(0, 80).replace(/\n/g, ' ');
    try {
      await connection.execute(sql);
      console.log(`  ✅ [${i + 1}/${MIGRATIONS.length}] ${preview}...`);
    } catch (error) {
      console.error(`  ❌ [${i + 1}/${MIGRATIONS.length}] ${preview}...`);
      console.error(`     Error: ${error.message}`);
    }
  }

  console.log('\n✅ Migrations completed!');
  await connection.end();
}

runMigrations().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
