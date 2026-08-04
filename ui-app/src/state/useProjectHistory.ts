import { useCallback, useState } from 'react';
import type { BitWireProject } from '../model/types';
import { cloneProject } from './project';

interface History { past: BitWireProject[]; present: BitWireProject; future: BitWireProject[] }

export function useProjectHistory(initial: BitWireProject) {
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] });

  const update = useCallback((recipe: (draft: BitWireProject) => void, record = true) => {
    setHistory(current => {
      const next = cloneProject(current.present);
      recipe(next);
      next.updatedAt = new Date().toISOString();
      if (!record) return { ...current, present: next };
      return { past: [...current.past.slice(-49), current.present], present: next, future: [] };
    });
  }, []);

  const replace = useCallback((project: BitWireProject) => {
    setHistory(current => ({ past: [...current.past.slice(-49), current.present], present: project, future: [] }));
  }, []);

  const reset = useCallback((project: BitWireProject) => setHistory({ past: [], present: project, future: [] }), []);

  const undo = useCallback(() => setHistory(current => {
    if (!current.past.length) return current;
    const present = current.past[current.past.length - 1];
    return { past: current.past.slice(0, -1), present, future: [current.present, ...current.future] };
  }), []);

  const redo = useCallback(() => setHistory(current => {
    if (!current.future.length) return current;
    const [present, ...future] = current.future;
    return { past: [...current.past, current.present], present, future };
  }), []);

  return {
    project: history.present, update, replace, reset, undo, redo,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0,
  };
}
