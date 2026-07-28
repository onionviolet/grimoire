import { useRef, useState } from 'react';
import { ImageOff, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TextureGridItem } from '../../types/foundry';

interface TextureCardProps {
  item: TextureGridItem;
  /** Resolved hero display name for item.hero, when the codename maps to one. */
  heroName?: string;
  /** Open the enlarge-on-click lightbox for this asset. */
  onOpen?: () => void;
  /** PNG drop/pick from the catalog card; the parent owns the Forge action. */
  onReplace?: (item: TextureGridItem, file: File) => void;
}

/**
 * One texture/icon tile in the Foundry browse grid: the decoded thumbnail (served
 * over the grimoire-foundry: scheme), the filename-derived label, and the hero
 * display name when the path encodes one. `content-visibility:auto` keeps a long
 * grid cheap to lay out (the same trick used on the Installed/Browse grids).
 * Clicking the tile enlarges it (decoded at full size on demand).
 */
export default function TextureCard({ item, heroName, onOpen, onReplace }: TextureCardProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.png')) return;
    onReplace?.(item, file);
  };
  return (
    <div
      className="group flex flex-col overflow-hidden rounded-sm border border-border bg-bg-secondary text-left transition-colors hover:border-accent/50 focus-visible:border-accent/50 focus-visible:outline-none"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '160px 180px' }}
      title={item.path}
    >
      <button type="button" onClick={onOpen} className="flex aspect-square items-center justify-center bg-bg-tertiary p-3">
        {item.thumbUrl ? (
          <img
            src={item.thumbUrl}
            alt={item.label}
            loading="lazy"
            className="h-full w-full object-contain [image-rendering:auto]"
            draggable={false}
          />
        ) : (
          <ImageOff size={28} className="text-text-secondary/40" />
        )}
      </button>
      <div className="flex flex-col gap-0.5 px-2 py-1.5">
        <span className="truncate text-xs font-medium capitalize text-text-primary" title={item.label}>
          {item.label || '(unnamed)'}
        </span>
        {heroName && <span className="truncate text-[11px] text-text-secondary">{heroName}</span>}
        {onReplace && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files?.[0]); }}
              className={`mt-1 flex items-center justify-center gap-1 rounded-sm border border-dashed px-1.5 py-1 text-[11px] ${dragging ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:border-accent/50 hover:text-text-primary'}`}
              title={t('foundry.texture.replaceHint', 'Drop a PNG here, or click to choose one')}
            >
              <Upload size={12} />
              {t('foundry.texture.replace', 'Replace PNG')}
            </button>
            <input ref={inputRef} type="file" accept=".png,image/png" className="hidden" onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }} />
          </>
        )}
      </div>
    </div>
  );
}
