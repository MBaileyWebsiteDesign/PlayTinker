// Projects are kept in this browser (localStorage) until accounts exist. Nothing is uploaded.
import { uid } from './util.js';

const KEY = 'playtinker.studio.v1';
const MAX_VERSIONS = 60;

let data = { currentId: null, projects: {} };
let memoryOnly = false;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = { currentId: null, projects: {}, ...JSON.parse(raw) };
  } catch (e) {
    memoryOnly = true;
  }
  return data;
}

export function save() {
  if (memoryOnly) return false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      // Storage full: drop the oldest versions of the biggest project and try again
      const p = Object.values(data.projects).sort((a, b) => b.versions.length - a.versions.length)[0];
      if (!p || p.versions.length <= 5) { memoryOnly = true; return false; }
      p.versions.splice(0, Math.ceil(p.versions.length / 3));
    }
  }
  return false;
}

export const isMemoryOnly = () => memoryOnly;

export function current() { return data.projects[data.currentId] || null; }

export function list() {
  return Object.values(data.projects).sort((a, b) => b.updated - a.updated);
}

export function open(id) {
  if (data.projects[id]) { data.currentId = id; save(); }
  return current();
}

export function remove(id) {
  delete data.projects[id];
  if (data.currentId === id) data.currentId = null;
  save();
}

export function create({ title, template, code, tests }) {
  const id = uid();
  const now = Date.now();
  const authors = '.'.repeat(code.split('\n').length);
  data.projects[id] = {
    id, title, template, code, authors, updated: now, created: now,
    testPlan: tests.map((text) => ({ id: uid(), text, status: 'todo', source: 'starter' })),
    versions: [{ n: 1, at: now, by: 'starter', message: `Started from the ${template} starter`, code, authors }],
    chat: [], lastCheck: null,
  };
  data.currentId = id;
  save();
  return data.projects[id];
}

export function addVersion(p, { by, message }) {
  const last = p.versions[p.versions.length - 1];
  if (last && last.code === p.code && by !== 'restore') return null;
  const v = { n: (last ? last.n : 0) + 1, at: Date.now(), by, message: message || (by === 'pip' ? 'Pip made a change' : 'Saved'), code: p.code, authors: p.authors };
  p.versions.push(v);
  if (p.versions.length > MAX_VERSIONS) p.versions.splice(1, p.versions.length - MAX_VERSIONS); // keep the starter
  touch(p);
  return v;
}

export function touch(p) { p.updated = Date.now(); save(); }

export function isDirty(p) {
  const last = p.versions[p.versions.length - 1];
  return !last || last.code !== p.code;
}
