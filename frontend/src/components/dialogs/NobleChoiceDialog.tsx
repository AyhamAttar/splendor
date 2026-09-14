"use client";

import { getNoble } from "@splendor/engine";
import { useMessages } from "@/i18n/I18nProvider";
import { Modal } from "../Modal";
import { NobleTile } from "../NobleTile";

export function NobleChoiceDialog({
  eligible,
  onChoose,
  busy,
}: {
  eligible: number[];
  onChoose: (nobleId: number) => void;
  busy: boolean;
}) {
  const m = useMessages();
  const d = m.dialogs.nobleChoice;
  return (
    <Modal title={d.title} dismissable={false}>
      <p className="text-sm text-parchment-300/80">{d.body}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        {eligible.map((id) => (
          <NobleTile
            key={id}
            noble={getNoble(id)}
            selectable
            onClick={() => !busy && onChoose(id)}
          />
        ))}
      </div>
    </Modal>
  );
}
