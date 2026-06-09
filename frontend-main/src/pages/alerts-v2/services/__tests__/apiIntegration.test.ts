/**
 * Integration tests for the Sentinel & IHMRef APIs.
 *
 * These tests hit the REAL backend to verify endpoint reachability and
 * response shape.  They are SKIPPED by default — to run them set the
 * environment variable before invoking vitest:
 *
 *   VITE_INTEGRATION_API=https://datarepr.duckdns.org/api/v1 npm run test:integration
 *
 * The `test:integration` npm script already filters to this file only.
 */
import { describe, it, expect } from 'vitest';
import axios from 'axios';

const API_BASE = process.env.VITE_INTEGRATION_API;

const describeIf = API_BASE ? describe : describe.skip;

// ── Helpers ────────────────────────────────────────────────────────────

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
  withCredentials: true,
});

// ── /sentinel/signals/ ────────────────────────────────────────────────

describeIf('GET /sentinel/signals/', () => {
  it('returns 200 and an array (or paginated envelope)', async () => {
    const { status, data } = await client.get('sentinel/signals/');
    expect(status).toBe(200);

    const results = Array.isArray(data) ? data : data.results;
    expect(Array.isArray(results)).toBe(true);
  });

  it('each signal has expected core fields', async () => {
    const { data } = await client.get('sentinel/signals/?limit=5');
    const results = Array.isArray(data) ? data : data.results;

    if (results.length === 0) {
      console.warn('⚠ No signals in database — shape test skipped');
      return;
    }

    const signal = results[0];
    // Fields guaranteed by the Django Signal serializer
    expect(signal).toHaveProperty('id');
    expect(signal).toHaveProperty('priority');
    expect(signal).toHaveProperty('status');
    expect(signal).toHaveProperty('created_at');
  });
});

// ── /sentinel/signals/stats/ ──────────────────────────────────────────

describeIf('GET /sentinel/signals/stats/', () => {
  it('returns 200 with total and breakdown objects', async () => {
    const { status, data } = await client.get('sentinel/signals/stats/');
    expect(status).toBe(200);

    expect(data).toHaveProperty('total');
    expect(typeof data.total).toBe('number');

    // These may be present as objects or arrays depending on serializer
    expect(data).toHaveProperty('by_priority');
    expect(data).toHaveProperty('by_status');
    expect(data).toHaveProperty('by_country');
  });
});

// ── /sentinel/diseases/ ───────────────────────────────────────────────

describeIf('GET /sentinel/diseases/', () => {
  it('returns 200 and a list of diseases', async () => {
    const { status, data } = await client.get('sentinel/diseases/');
    expect(status).toBe(200);

    const results = Array.isArray(data) ? data : data.results;
    expect(Array.isArray(results)).toBe(true);
  });

  it('each disease has name and code/id', async () => {
    const { data } = await client.get('sentinel/diseases/');
    const results = Array.isArray(data) ? data : data.results;

    if (results.length === 0) {
      console.warn('⚠ No diseases in database — shape test skipped');
      return;
    }

    const disease = results[0];
    // At minimum we need a name field
    const hasName = 'disease_name' in disease || 'name' in disease;
    expect(hasName).toBe(true);
  });
});

// ── /ihmref/country/incident ──────────────────────────────────────────

describeIf('GET /ihmref/country/incident', () => {
  it('returns 200 and a list of incidents', async () => {
    const { status, data } = await client.get('/ihmref/country/incident');
    expect(status).toBe(200);

    const results = Array.isArray(data) ? data : data.results;
    expect(Array.isArray(results)).toBe(true);
  });

  it('each incident has expected shape', async () => {
    const { data } = await client.get('/ihmref/country/incident');
    const results = Array.isArray(data) ? data : data.results;

    if (results.length === 0) {
      console.warn('⚠ No incidents in database — shape test skipped');
      return;
    }

    const incident = results[0];
    expect(incident).toHaveProperty('id');
    expect(incident).toHaveProperty('incident');
    expect(incident).toHaveProperty('country');
  });
});
