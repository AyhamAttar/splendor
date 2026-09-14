"use client";

import type { Gem } from "@splendor/engine";
import type { GemCounts } from "@/hooks/useSelection";
import { GEM_ORDER } from "@/lib/gems";
import { useT, useMessages } from "@/i18n/I18nProvider";
import { TokenChip } from "./TokenChip";
import { Button } from "./Button";

export function ActionBar({
  gems,
  total,
  onRemove,
  onConfirmTake,
  onClear,
  canPass,
  onPass,
  busy,
  error,
  disabled,
  handleProps,
  onResetPosition,
  minimized = false,
  onToggleMinimize,
  resizeHandleProps,
  onResetSize,
}: {
  gems: GemCounts;
  total: number;
  onRemove: (g: Gem) => void;
  onConfirmTake: () => void;
  onClear: () => void;
  canPass: boolean;
  onPass: () => void;
  busy: boolean;
  error: string | null;
  disabled: boolean;
  handleProps?: React.HTMLAttributes<HTMLButtonElement> & {
    style?: React.CSSProperties;
  };
  onResetPosition?: () => void;
  moved?: boolean;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  resizeHandleProps?: React.HTMLAttributes<HTMLButtonElement> & {
    style?: React.CSSProperties;
  };
  onResetSize?: () => void;
}) {
  const t = useT();
  const m = useMessages();
  const chips: Gem[] = [];
  for (const g of GEM_ORDER)
    for (let i = 0; i < (gems[g] ?? 0); i++) chips.push(g);

  return (
    <div className="gold-hairline relative flex h-full w-full flex-wrap items-center gap-3 rounded-lg bg-navy-950/85 p-3 shadow-raise-3 backdrop-blur">
      {handleProps && (
        <button
          type="button"
          aria-label={m.actionBar.dragLabel}
          title={m.actionBar.dragTitle}
          onDoubleClick={onResetPosition}
          {...handleProps}
          className="-my-1 -ms-1 flex h-7 w-5 shrink-0 items-center justify-center rounded text-gold-300/50 hover:bg-navy-800 hover:text-gold-300 active:cursor-grabbing"
        >
          <svg width="8" height="16" viewBox="0 0 8 16" aria-hidden="true">
            <g fill="currentColor">
              <circle cx="2" cy="3" r="1.2" />
              <circle cx="6" cy="3" r="1.2" />
              <circle cx="2" cy="8" r="1.2" />
              <circle cx="6" cy="8" r="1.2" />
              <circle cx="2" cy="13" r="1.2" />
              <circle cx="6" cy="13" r="1.2" />
            </g>
          </svg>
        </button>
      )}
      <span className="font-display text-xs uppercase tracking-widest text-gold-300/70">
        {m.actionBar.yourTurn}
      </span>

      {!minimized &&
        (chips.length > 0 ? (
          <div className="flex items-center gap-1.5">
            {chips.map((g, i) => (
              <TokenChip
                key={`${g}-${i}`}
                color={g}
                size="sm"
                onClick={() => onRemove(g)}
                title={t("actionBar.removeGem", { gem: g })}
              />
            ))}
          </div>
        ) : (
          <span className="text-sm text-parchment-300/50">
            {m.actionBar.prompt}
          </span>
        ))}

      <div className="ms-auto flex items-center gap-2">
        {!minimized && (
          <>
            {error && <span className="text-sm text-gem-red">{error}</span>}
            {total > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                disabled={busy || disabled}
              >
                {m.actionBar.clear}
              </Button>
            )}
            <Button
              onClick={onConfirmTake}
              disabled={total === 0 || busy || disabled}
            >
              {m.actionBar.takeGems}
            </Button>
            {canPass && (
              <button
                onClick={onPass}
                disabled={busy || disabled}
                className="gold-hairline rounded px-3 py-1.5 text-sm text-parchment-100 hover:bg-navy-800 disabled:opacity-40"
              >
                {m.actionBar.pass}
              </button>
            )}
          </>
        )}
        {onToggleMinimize && (
          <button
            type="button"
            onClick={onToggleMinimize}
            aria-label={minimized ? m.actionBar.expand : m.actionBar.minimize}
            aria-expanded={!minimized}
            title={minimized ? m.actionBar.expand : m.actionBar.minimize}
            className="-me-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-gold-300/60 hover:bg-navy-800 hover:text-gold-300"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className={minimized ? "" : "rotate-180"}
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {!minimized && resizeHandleProps && (
        <button
          type="button"
          aria-label={m.actionBar.resizeLabel}
          title={m.actionBar.resizeTitle}
          onDoubleClick={onResetSize}
          {...resizeHandleProps}
          className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded text-gold-300/40 hover:text-gold-300"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <line x1="11" y1="4" x2="4" y2="11" />
              <line x1="11" y1="8" x2="8" y2="11" />
            </g>
          </svg>
        </button>
      )}
    </div>
  );
}
