#!/usr/bin/env node

// Finds and merges duplicate constituents in Bloomerang.
//
// Duplicate rules:
//   1. Same email + same first name  → merge newer into older
//   2. Same first + last name (any email) → merge newer into older, copy email
//
// "Older" = lower Bloomerang ID (created first). We always keep the older one.
//
// Usage:
//   node scripts/merge-duplicates.js              # Dry run (shows what would happen)
//   node scripts/merge-duplicates.js --execute    # Actually merge and delete

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Load env from admin/server/.env if BLOOMERANG_API_KEY not already set
if (!process.env.BLOOMERANG_API_KEY) {
  const envPath = path.join(__dirname, '..', 'admin', 'server', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const API_BASE = 'https://api.bloomerang.co/v2';
const API_KEY = process.env.BLOOMERANG_API_KEY;
const DRY_RUN = !process.argv.includes('--execute');
const PAGE_SIZE = 50;
const RATE_LIMIT_MS = 300; // pause between write calls

if (!API_KEY) {
  console.error('Missing BLOOMERANG_API_KEY environment variable');
  process.exit(1);
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Fetch all constituents (paginated) ───────────────────────────

async function fetchAllConstituents() {
  const all = [];
  let skip = 0;
  let total = null;

  while (total === null || skip < total) {
    const { data } = await api.get('/constituents', {
      params: { skip, take: PAGE_SIZE, type: 'Individual', orderBy: 'Id', orderDirection: 'Asc' }
    });

    total = data.Total;
    all.push(...data.Results);
    skip += PAGE_SIZE;
    process.stdout.write(`\r  Fetched ${all.length} / ${total} constituents...`);
  }
  console.log(' done.');
  return all;
}

// ── Fetch single constituent (full detail if list is missing emails) ─

async function fetchConstituent(id) {
  const { data } = await api.get(`/constituent/${id}`);
  return data;
}

// ── Find duplicate pairs ─────────────────────────────────────────

function findDuplicates(constituents) {
  const emailFirstMap = new Map(); // "email|firstName" → [constituents]
  const fullNameMap = new Map();   // "firstName|lastName" → [constituents]

  for (const c of constituents) {
    const email = (c.PrimaryEmail?.Value || '').toLowerCase().trim();
    const first = (c.FirstName || '').toLowerCase().trim();
    const last = (c.LastName || '').toLowerCase().trim();

    if (email && first) {
      const key = `${email}|${first}`;
      if (!emailFirstMap.has(key)) emailFirstMap.set(key, []);
      emailFirstMap.get(key).push(c);
    }

    if (first && last) {
      const key = `${first}|${last}`;
      if (!fullNameMap.has(key)) fullNameMap.set(key, []);
      fullNameMap.get(key).push(c);
    }
  }

  const merges = [];
  const markedForRemoval = new Set();

  // Rule 1: same email + same first name
  for (const [key, group] of emailFirstMap) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.Id - b.Id); // oldest first
    const keep = group[0];
    for (let i = 1; i < group.length; i++) {
      if (markedForRemoval.has(group[i].Id)) continue;
      merges.push({ keep, remove: group[i], reason: 'Same email + first name' });
      markedForRemoval.add(group[i].Id);
    }
  }

  // Rule 2: same first + last name (may have different emails)
  for (const [key, group] of fullNameMap) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.Id - b.Id);
    const keep = group[0];
    for (let i = 1; i < group.length; i++) {
      if (markedForRemoval.has(group[i].Id)) continue;
      merges.push({ keep, remove: group[i], reason: 'Same first + last name' });
      markedForRemoval.add(group[i].Id);
    }
  }

  return merges;
}

// ── Copy email from removed constituent to kept one ──────────────

async function copyEmailIfNeeded(keep, remove) {
  const removeEmail = (remove.PrimaryEmail?.Value || '').toLowerCase().trim();
  const keepEmail = (keep.PrimaryEmail?.Value || '').toLowerCase().trim();

  if (!removeEmail) return false;
  if (removeEmail === keepEmail) return false;

  console.log(`    Copy email "${remove.PrimaryEmail.Value}" → constituent #${keep.Id}`);
  if (!DRY_RUN) {
    await api.post('/email', {
      AccountId: keep.Id,
      Type: 'Home',
      Value: remove.PrimaryEmail.Value,
      IsPrimary: !keepEmail // make primary only if keeper has none
    });
    await sleep(RATE_LIMIT_MS);
  }
  return true;
}

// ── Delete the newer constituent ─────────────────────────────────

async function deleteConstituent(id) {
  console.log(`    Delete constituent #${id}`);
  if (!DRY_RUN) {
    await api.delete(`/constituent/${id}`);
    await sleep(RATE_LIMIT_MS);
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Bloomerang Duplicate Constituent Merger ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : '⚠️  LIVE — changes will be made!'}\n`);

  // 1. Fetch all constituents
  console.log('Step 1: Fetching all constituents...');
  const constituents = await fetchAllConstituents();
  console.log(`  Total: ${constituents.length} individual constituents\n`);

  // Check if list response includes PrimaryEmail
  const sampleHasEmail = constituents.length > 0 && constituents[0].PrimaryEmail !== undefined;
  if (!sampleHasEmail && constituents.length > 0) {
    console.log('  List response missing PrimaryEmail, fetching full details...');
    for (let i = 0; i < constituents.length; i++) {
      const full = await fetchConstituent(constituents[i].Id);
      constituents[i] = full;
      process.stdout.write(`\r  Enriched ${i + 1} / ${constituents.length}...`);
      await sleep(RATE_LIMIT_MS);
    }
    console.log(' done.\n');
  }

  // 2. Find duplicates
  console.log('Step 2: Finding duplicates...');
  const merges = findDuplicates(constituents);
  console.log(`  Found ${merges.length} duplicates to merge\n`);

  if (merges.length === 0) {
    console.log('No duplicates found. Done!');
    return;
  }

  // 3. Show / execute merges
  console.log(`Step 3: ${DRY_RUN ? 'Preview' : 'Executing'} merges...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < merges.length; i++) {
    const { keep, remove, reason } = merges[i];
    const keepName = `${keep.FirstName || ''} ${keep.LastName || ''}`.trim();
    const removeName = `${remove.FirstName || ''} ${remove.LastName || ''}`.trim();
    const keepEmail = keep.PrimaryEmail?.Value || '(none)';
    const removeEmail = remove.PrimaryEmail?.Value || '(none)';

    console.log(`  [${i + 1}/${merges.length}] ${reason}`);
    console.log(`    KEEP:   #${keep.Id} — ${keepName} <${keepEmail}>`);
    console.log(`    REMOVE: #${remove.Id} — ${removeName} <${removeEmail}>`);

    try {
      await copyEmailIfNeeded(keep, remove);
      await deleteConstituent(remove.Id);
      successCount++;
    } catch (err) {
      errorCount++;
      const msg = err.response?.data?.Message || err.response?.data || err.message;
      console.log(`    ERROR: ${JSON.stringify(msg)}`);
    }
    console.log();
  }

  // 4. Summary
  console.log('=== Summary ===');
  console.log(`  Total duplicates found: ${merges.length}`);
  if (DRY_RUN) {
    console.log('  Mode: DRY RUN — no changes were made');
    console.log('  Run with --execute to apply changes');
  } else {
    console.log(`  Merged successfully: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
  }
  console.log();
}

main().catch(err => {
  console.error('Fatal error:', err.response?.data || err.message);
  process.exit(1);
});
