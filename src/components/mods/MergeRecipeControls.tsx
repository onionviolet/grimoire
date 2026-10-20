import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MergeAnalysisResult } from '../../types/mod';
import type { MergeRecipe, MergeRecipeReview, MergePathPolicy } from '../../types/mergeRecipe';
import { Button } from '../common/ui';
import { FormField, Select, Textarea } from '../common/forms';

export default function MergeRecipeControls({ name, strict, modIds, analysis, policy, includeText, excludeText, onInclude, onExclude, onLoad }: {
  name: string; strict: boolean; modIds: string[]; analysis: MergeAnalysisResult | null; policy: MergePathPolicy;
  includeText: string; excludeText: string; onInclude: (text: string) => void; onExclude: (text: string) => void; onLoad: (review: MergeRecipeReview) => void;
}) {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<MergeRecipe[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [diff, setDiff] = useState<MergeRecipeReview | null>(null);
  useEffect(() => {
    let active = true;
    window.electronAPI.listMergeRecipes().then(items => { if (active) setRecipes(items); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  const save = async () => {
    if (!analysis?.reviewToken) return;
    setBusy(true); setFailed(false); setSaved(false);
    try {
      await window.electronAPI.saveMergeRecipe({ name, strict, policy, modIds: [...analysis.sources].reverse().map(source => source.modId), reviewToken: analysis.reviewToken });
      setRecipes(await window.electronAPI.listMergeRecipes()); setSaved(true);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  };
  const load = async () => {
    setBusy(true); setFailed(false); setSaved(false);
    try { const review = await window.electronAPI.reviewMergeRecipe(selected, modIds); setDiff(review); onLoad(review); }
    catch { setDiff(null); setFailed(true); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-sm border border-border p-3">
    <p className="text-sm text-text-primary">{t('mergeRecipes.title')}</p>
    <p className="text-xs text-text-secondary">{t('mergeRecipes.help')}</p>
    <FormField label={t('mergeRecipes.include')}>
      <Textarea rows={2} value={includeText} disabled={busy} onChange={event => { onInclude(event.target.value); setDiff(null); setSaved(false); }} />
    </FormField>
    <FormField label={t('mergeRecipes.exclude')}>
      <Textarea rows={2} value={excludeText} disabled={busy} onChange={event => { onExclude(event.target.value); setDiff(null); setSaved(false); }} />
    </FormField>
    <div className="flex flex-wrap gap-3">
      <Select aria-label={t('mergeRecipes.select')} value={selected} disabled={busy} className="max-w-80" onChange={event => setSelected(event.target.value)}>
        <option value="">{t('mergeRecipes.select')}</option>
        {recipes.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
      </Select>
      <Button size="sm" variant="secondary" disabled={busy || !selected} onClick={() => void load()}>{t('mergeRecipes.load')}</Button>
      <Button size="sm" variant="secondary" disabled={busy || !name.trim() || !analysis?.reviewToken || !!analysis.unreadableModIds.length} onClick={() => void save()}>{t('mergeRecipes.save')}</Button>
    </div>
    {saved && <p role="status" className="text-xs text-text-secondary">{t('mergeRecipes.saved')}</p>}
    {failed && <p role="alert" className="text-xs text-state-danger">{t('mergeRecipes.failed')}</p>}
    {diff && <details className="text-xs text-text-secondary">
      <summary className="cursor-pointer">{t('mergeRecipes.diff', { added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length })}</summary>
      <ul className="max-h-48 overflow-y-auto">
        {(['added', 'removed', 'changed'] as const).flatMap(kind => diff[kind].map(path => <li key={`${kind}:${path}`} className="break-all py-1">{t(`mergeRecipes.${kind}`)}: {path}</li>))}
      </ul>
    </details>}
  </section>;
}
