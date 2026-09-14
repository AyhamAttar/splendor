"use client";

import { getNoble } from "@splendor/engine";
import { useMessages } from "@/i18n/I18nProvider";
import { NobleTile } from "./NobleTile";
import { useInspect } from "./CardInspectContext";

export function NobleRow({ nobleIds }: { nobleIds: number[] }) {
  const m = useMessages();
  const inspect = useInspect();
  return (
    <div className="flex min-h-24 flex-col gap-3">
      {nobleIds.length === 0 ? (
        <p className="text-sm text-parchment-300/60">{m.nobleRow.allClaimed}</p>
      ) : (
        nobleIds.map((id) => (
          <NobleTile
            key={id}
            noble={getNoble(id)}
            onClick={() => inspect({ kind: "noble", nobleId: id })}
          />
        ))
      )}
    </div>
  );
}
