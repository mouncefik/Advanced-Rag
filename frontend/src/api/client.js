export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export async function uploadDocument(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/process`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function apiHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    return { status: 'error', time: Date.now() };
  }
  return res.json();
}

export async function ragInit(recognitionDir) {
  const body = recognitionDir ? { recognition_dir: recognitionDir } : {};
  const res = await fetch(`${API_BASE}/rag/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `RAG init failed: ${res.status}`);
  }
  return res.json();
}

export async function ragStatus() {
  const res = await fetch(`${API_BASE}/rag/status`);
  if (!res.ok) {
    return { initialized: false, chunks_indexed: 0 };
  }
  return res.json();
}

export async function ragQuery(question, k = 3) {
  const res = await fetch(`${API_BASE}/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, k }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `RAG query failed: ${res.status}`);
  }
  return res.json();
}