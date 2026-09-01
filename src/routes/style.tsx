import { createFileRoute } from "@tanstack/react-router";
import { StyleStudio } from "@/components/style-studio";
import { usePlayer } from "@/lib/store";

export const Route = createFileRoute("/style")({ component: () => null });

export function StylePage() {
  const player = usePlayer();
  return (
    <StyleStudio
      asPage
      equipped={player.equip}
      onEquip={(_kind, id) => player.equipCosmetic(id)}
    />
  );
}
