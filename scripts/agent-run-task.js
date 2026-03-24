#!/usr/bin/env node
/**
 * Run one task: call OpenAI to implement, apply edits, run tests.
 * Usage: node scripts/agent-run-task.js <taskId>
 * Env: OPENAI_API_KEY required. GITHUB_WORKSPACE or cwd = repo root.
 * Exit: 0 if tests pass, 1 otherwise.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.env.GITHUB_WORKSPACE || process.cwd();
const taskId = process.argv[2];
if (!taskId) {
  console.error('Usage: node scripts/agent-run-task.js <taskId>');
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY is required');
  process.exit(1);
}

const TASKS_PATH = path.join(root, 'initiative-1-tracker', 'TASKS.md');
const TRACKER_DIR = path.join(root, 'initiative-1-tracker', 'tracker');

// Files we can send as context (Tracker app). Paths relative to root.
const CONTEXT_FILES = [
  'initiative-1-tracker/tracker/lib/collect.js',
  'initiative-1-tracker/tracker/lib/gapReport.js',
  'initiative-1-tracker/tracker/lib/loadConfig.js',
  'initiative-1-tracker/tracker/server.js',
  'initiative-1-tracker/tracker/public/index.html',
  'initiative-1-tracker/tracker/README.md',
];

function getTaskRow() {
  const content = fs.readFileSync(TASKS_PATH, 'utf8');
  const escaped = taskId.replace('.', '\\.');
  const re = new RegExp(`^\\|\\s*${escaped}\\s*\\|[^\\n]+\\|\\s*\\[\\s\\]\\s*\\|`, 'm');
  const m = content.match(re);
  return m ? m[0].trim() : null;
}

function loadContext(maxChars = 60000) {
  const out = [];
  let total = 0;
  for (const rel of CONTEXT_FILES) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf8');
    if (total + content.length > maxChars) break;
    total += content.length;
    out.push({ path: rel, content });
  }
  return out;
}

function callOpenAI(taskRow, contextFiles) {
  const contextBlob = contextFiles
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n');

  const systemPrompt = `You are a precise coding agent. Implement exactly one task from the repo's TASKS.md.
Respond with a single JSON object only, no markdown or explanation:
{"edits":[{"path":"path/from/repo/root","content":"full file content"}]}
- path: relative to repo root (e.g. initiative-1-tracker/tracker/lib/collect.js).
- content: complete new content for that file. Include only files you actually changed.
- If the task is already satisfied by the current code, respond with {"edits":[]}.`;

  const userPrompt = `Task row from TASKS.md:\n${taskRow}\n\nCurrent files:\n${contextBlob}\n\nImplement the task. Output only the JSON object.`;

  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  }).then((r) => r.json());
}

function extractJson(text) {
  let s = text.trim();
  const block = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) s = block[1].trim();
  return JSON.parse(s);
}

function applyEdits(edits) {
  for (const { path: rel, content } of edits) {
    if (!rel || content === undefined) continue;
    const full = path.join(root, rel);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
}

function markTaskDone(taskId) {
  let content = fs.readFileSync(TASKS_PATH, 'utf8');
  const re = new RegExp(
    `(\\|\\s*${taskId.replace('.', '\\.')}\\s*\\|[^|]+\\|)\\s*\\[\\s\\]\\s*(\\|)`,
    'm'
  );
  content = content.replace(re, '$1 [x] $2');
  fs.writeFileSync(TASKS_PATH, content, 'utf8');
}

function runTests() {
  try {
    execSync('node test/run.js', {
      cwd: TRACKER_DIR,
      stdio: 'inherit',
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const taskRow = getTaskRow();
  if (!taskRow) {
    console.error('Task row not found for', taskId);
    process.exit(1);
  }

  const contextFiles = loadContext();
  const response = await callOpenAI(taskRow, contextFiles);
  const text = response.choices?.[0]?.message?.content;
  if (!text) {
    console.error('No response from API:', response.error?.message || response);
    process.exit(1);
  }

  let edits;
  try {
    const parsed = extractJson(text);
    edits = Array.isArray(parsed.edits) ? parsed.edits : [];
  } catch (e) {
    console.error('Failed to parse API response as JSON:', e.message);
    process.exit(1);
  }

  if (edits.length === 0) {
    console.log('API returned no edits (task may already be done). Marking done and running tests.');
    markTaskDone(taskId);
    const ok = runTests();
    process.exit(ok ? 0 : 1);
  }

  applyEdits(edits);
  markTaskDone(taskId);
  const ok = runTests();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
