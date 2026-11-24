import { foundryCheckAudioPaths, showOpenDialog } from '../../lib/api';
import type { HeroSoundSwapRequest } from '../../types/foundry';
import { soundSourceFiles } from './buildTray';

export async function relinkSoundSources(paths: string[], dialogTitle: (file: string) => string) {
  const unique = [...new Set(paths)];
  const available = new Set(unique.length ? await foundryCheckAudioPaths(unique) : []);
  const relinked = new Map<string, string>();
  for (const path of unique) {
    if (available.has(path)) continue;
    const picked = await showOpenDialog({
      title: dialogTitle(path.split(/[\\/]/).pop() ?? path),
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'] }],
    });
    if (!picked) return null;
    relinked.set(path, picked);
  }
  return relinked;
}

export function replaceSoundSourcePaths<T extends Pick<HeroSoundSwapRequest, 'audioPath' | 'stockDonor' | 'assignments'>>(request: T, sources: Map<string, string>): T {
  return {
    ...request,
    audioPath: request.stockDonor ? request.audioPath : sources.get(request.audioPath) ?? request.audioPath,
    assignments: request.assignments?.map((assignment) => ({
      ...assignment,
      audioPath: request.stockDonor && assignment.audioPath === request.audioPath
        ? assignment.audioPath : sources.get(assignment.audioPath) ?? assignment.audioPath,
    })),
  };
}

export async function prepareSoundRebuild<T extends Pick<HeroSoundSwapRequest, 'audioPath' | 'stockDonor' | 'assignments'>>(
  request: T,
  dialogTitle: (file: string) => string,
  confirmUpdatedStock: (clip: string) => Promise<boolean>,
): Promise<T | null> {
  const donor = request.stockDonor;
  let refreshed = request;
  if (donor) {
    const latest = await window.electronAPI.foundry.stockSound(donor.clipPath);
    if (!latest) throw new Error(`Stock audio could not be opened: ${donor.clipPath}`);
    if (latest.fingerprint !== donor.fingerprint) {
      if (!(await confirmUpdatedStock(donor.clipPath))) return null;
      refreshed = { ...request, stockDonor: { ...donor, fingerprint: latest.fingerprint } };
    }
  }
  const paths = await relinkSoundSources(soundSourceFiles(refreshed), dialogTitle);
  return paths && replaceSoundSourcePaths(refreshed, paths);
}
