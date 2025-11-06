#!/usr/bin/env tsx
/**
 * Chargebee Verification Script
 * Lists all created plans and prices to verify setup
 */

import Chargebee from 'chargebee';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../lib/logger.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

// Initialize Chargebee SDK
const chargebee = new Chargebee({
  site: process.env.CHARGEBEE_SITE!,
  apiKey: process.env.CHARGEBEE_API_KEY!
});

async function verifySetup() {
  logger.info('🔍 Verifying Chargebee Setup...\n');

  try {
    // List all items
    logger.info('📋 Plan Items:');
    const itemsResult = await chargebee.item.list({
      limit: 10,
    } as any);

    for (const entry of itemsResult.list) {
      logger.info(`  • ${entry.item.id} - ${entry.item.name}`);
    }

    // List all item prices
    logger.info('\n💰 Item Prices:');
    const pricesResult = await chargebee.itemPrice.list({
      limit: 20
    } as any);

    for (const entry of pricesResult.list) {
      const price = entry.item_price;
      const displayPrice = price.currency_code === 'USD'
        ? `$${(price.price! / 100).toFixed(2)}`
        : `₹${(price.price! / 100).toFixed(2)}`;
      const period = price.period_unit === 'year' ? 'year' : 'month';
      logger.info(`  • ${price.id} - ${displayPrice}/${period} (${price.currency_code})`);
    }

    // List all features
    logger.info('\n📦 Features:');
    const featuresResult = await chargebee.feature.list({
      limit: 10
    } as any);

    for (const entry of featuresResult.list) {
      logger.info(`  • ${entry.feature.id} - ${entry.feature.name}`);
    }

    logger.info('\n✅ Verification complete!');
  } catch (error: any) {
    logger.error('❌ Verification failed:', error.message);
  }
}

verifySetup();
