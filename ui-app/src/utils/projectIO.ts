import type { BitWireProject } from '../model/types';
import { validateProject } from '../state/project';

const STORAGE_KEY = 'bitwire:last-project';

export function saveProjectLocally(project: BitWireProject): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  const recent = JSON.parse(localStorage.getItem('bitwire:recent') ?? '[]') as Array<{ id: string; name: string; updatedAt: string }>;
  const next = [{ id: project.id, name: project.name, updatedAt: project.updatedAt }, ...recent.filter(item => item.id !== project.id)].slice(0, 8);
  localStorage.setItem('bitwire:recent', JSON.stringify(next));
}

export function loadLocalProject(): BitWireProject | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return validateProject(JSON.parse(raw)); } catch { return null; }
}

export function exportProject(project: BitWireProject): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/vnd.bitwire+json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${project.name.toLocaleLowerCase('es').replace(/[^a-z0-9áéíóúñ]+/gi, '-') || 'circuito'}.bitwire`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importProject(file: File): Promise<BitWireProject> {
  if (file.size > 20_000_000) throw new Error('El proyecto supera el límite de 20 MB.');
  const parsed = JSON.parse(await file.text()) as unknown;
  return validateProject(parsed);
}
