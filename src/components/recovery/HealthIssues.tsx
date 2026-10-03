import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { HealthIssue } from '../../types/recovery';
import { Button } from '../common/ui';

export default function HealthIssues({ issues }: { issues: HealthIssue[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const describe = (code: HealthIssue['code']) => {
    switch (code) {
      case 'path-invalid': return t('recovery.issues.pathInvalid');
      case 'gameinfo-missing': return t('recovery.issues.gameinfoMissing');
      case 'gameinfo-unreadable': return t('recovery.issues.gameinfoUnreadable');
      case 'gameinfo-unwritable': return t('recovery.issues.gameinfoUnwritable');
      case 'search-paths-missing': return t('recovery.issues.searchPathsMissing');
      case 'boot-paths-missing': return t('recovery.issues.bootPathsMissing');
      case 'language-paths-missing': return t('recovery.issues.languagePathsMissing');
      case 'folder-unreadable': return t('recovery.issues.folderUnreadable');
      case 'vpk-invalid': return t('recovery.issues.vpkInvalid');
      case 'vpk-tree-invalid': return t('recovery.issues.vpkTreeInvalid');
      case 'metadata-unreadable': return t('recovery.issues.metadataUnreadable');
      case 'metadata-missing-file': return t('recovery.issues.metadataMissingFile');
      case 'metadata-missing-entry': return t('recovery.issues.metadataMissingEntry');
      case 'metadata-ambiguous': return t('recovery.issues.metadataAmbiguous');
      case 'disk-low': return t('recovery.issues.diskLow');
      case 'disk-unavailable': return t('recovery.issues.diskUnavailable');
    }
  };
  return (
    <ul className="space-y-3">
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${issue.location ?? issue.fileName ?? index}`} className="rounded-sm border border-border bg-bg-secondary p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`text-xs ${issue.severity === 'blocking' ? 'text-state-danger' : 'text-state-warning'}`}>
              {issue.severity === 'blocking' ? t('recovery.blocking') : t('recovery.warning')}
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate(issue.target === 'installed' ? '/' : '/settings/game')}>
              {issue.target === 'installed' ? t('recovery.openInstalled') : issue.target === 'config' ? t('recovery.openConfig') : t('recovery.openSettings')}
            </Button>
          </div>
          {issue.modName && <p className="font-mod-title text-base text-text-primary break-words">{issue.modName}</p>}
          <p className="text-sm text-text-secondary">{describe(issue.code)}</p>
          {(issue.location || issue.fileName) && <p className="font-mono text-xs text-text-tertiary break-all">{issue.location ?? issue.fileName}</p>}
        </li>
      ))}
    </ul>
  );
}
