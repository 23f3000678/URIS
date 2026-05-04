'use strict';

// Load .env.test overrides before any test module is required.
// This ensures DATABASE_URL, NODE_ENV=test, and rate-limit overrides
// are in place before Prisma or any service module initialises.
require('dotenv').config({ path: require('path').resolve(__dirname, '.env.test') });
