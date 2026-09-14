"use client";

import { useState } from "react";
import type { TokenBag, TokenColor } from "@splendor/engine";
import { useMessages, useT } from "@/i18n/I18nProvider";
import { Modal } from "../Modal";
import { Button } from "../Button";
import { GemPip } from "../GemPip";
import { TOKEN_ORDER } from "@/lib/gems";

const ZERO: Record<TokenColor, number> = {
  white: 0,
  blue: 0,
  green: 0,
  red: 0,
  black: 0,
  gold: 0,
};

export function TokenReturnDialog({
  projected,
  mustReturn,
  onConfirm,
  onClose,
  busy,
}: {
  projected: Record<TokenColor, number>;
  mustReturn: number;
  onConfirm: (ret: TokenBag) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [ret, setRet] = useState<Record<TokenColor, number>>({ ...ZERO });
  const m = useMessages();
  const t = useT();
  const d = m.dialogs.tokenReturn;
  const totalRet = TOKEN_ORDER.reduce((n, c) => n + ret[c], 0);
  const colors = TOKEN_ORDER.filter((c) => projected[c] > 0);

  const inc = (c: TokenColor) => {
    if (ret[c] < projected[c] && totalRet < mustReturn)
      setRet((r) => ({ ...r, [c]: r[c] + 1 }));
  };
  const dec = (c: TokenColor) => {
    if (ret[c] > 0) setRet((r) => ({ ...r, [c]: r[c] - 1 }));
  };

  const compact: TokenBag = {};
  for (const c of TOKEN_ORDER) if (ret[c] > 0) compact[c] = ret[c];

  const title =
    mustReturn === 1
      ? t("dialogs.tokenReturn.titleSingular", { n: mustReturn })
      : t("dialogs.tokenReturn.titlePlural", { n: mustReturn });

  return (
    <Modal title={title}>
      <p className="text-sm text-parchment-300/80">{d.body}</p>

      <div className="mt-3 flex flex-col gap-2">
        {colors.map((c) => (
          <div
            key={c}
            className="flex items-center justify-between gap-3 rounded bg-navy-900/50 px-3 py-1.5"
          >
            <span className="flex items-center gap-2 text-sm">
              <GemPip color={c}>{projected[c]}</GemPip>
              <bdi>{m.gems[c]}</bdi>
            </span>
            <span className="flex items-center gap-2" dir="ltr">
              <button
                onClick={() => dec(c)}
                disabled={ret[c] === 0}
                className="gold-hairline grid h-6 w-6 place-items-center rounded text-base leading-none text-parchment-100 transition duration-150 ease-out-expo hover:bg-navy-800 active:translate-y-px disabled:opacity-30 disabled:hover:bg-transparent"
              >
                −
              </button>
              <span className="w-4 text-center text-sm">{ret[c]}</span>
              <button
                onClick={() => inc(c)}
                disabled={ret[c] >= projected[c] || totalRet >= mustReturn}
                className="gold-hairline grid h-6 w-6 place-items-center rounded text-base leading-none text-parchment-100 transition duration-150 ease-out-expo hover:bg-navy-800 active:translate-y-px disabled:opacity-30 disabled:hover:bg-transparent"
              >
                +
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-parchment-300/70">
          {t("dialogs.tokenReturn.returning", { ret: totalRet, total: mustReturn })}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {d.cancel}
          </Button>
          <Button
            onClick={() => onConfirm(compact)}
            disabled={totalRet !== mustReturn || busy}
          >
            {d.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
