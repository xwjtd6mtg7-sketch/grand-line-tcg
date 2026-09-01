import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/rules")({ component: () => null });

const SECTIONS = [
  {
    n: "01",
    title: "Le deck",
    body: "1 Leader, 50 cartes, 10 DON!!. Maximum 4 exemplaires d’une même carte. Uniquement les couleurs du Leader.",
  },
  {
    n: "02",
    title: "Mise en place",
    body: "Pioche 5 cartes, mulligan possible, puis pose tes vies depuis le dessus du deck — autant que la valeur Life du Leader.",
  },
  {
    n: "03",
    title: "Déroulement d’un tour",
    body: "Refresh → Pioche → DON!! → Phase principale → Fin de tour.",
  },
  {
    n: "04",
    title: "Refresh",
    body: "Les DON!! attachés reviennent reposer dans ta zone DON!!. Ensuite, toutes tes cartes se redressent.",
  },
  {
    n: "05",
    title: "Premier tour",
    body: "Le premier joueur ne pioche pas et ne gagne qu’1 DON!!. Personne n’attaque au premier tour.",
  },
  {
    n: "06",
    title: "Jouer une carte",
    body: "Repose autant de DON!! actifs que le coût. Les DON!! attachés donnent +1000 de puissance, uniquement pendant ton tour.",
  },
  {
    n: "07",
    title: "Attaque",
    body: "Repose un Leader ou un Personnage. Rush peut attaquer le tour où il est posé. 5 Personnages max — le 6e remplace.",
  },
  {
    n: "08",
    title: "Bloqueur & Contre",
    body: "Un Bloqueur peut intercepter. Puis Contre : Événement payé ou Personnage défaussé. Si l’attaquant a une puissance ≥ défenseur, l’attaque réussit.",
  },
  {
    n: "09",
    title: "Dégâts & victoire",
    body: "Dégâts au Leader : 1 vie (2 si Double Attack). 0 vie + dégâts = défaite. Deck vide = défaite.",
  },
  {
    n: "10",
    title: "Trigger & Banish",
    body: "Tu choisis d’activer le Trigger. Si tu l’actives, la carte va à la poubelle (sauf texte contraire). Banish : la vie va à la poubelle, sans Trigger.",
  },
];

export function RulesPage() {
  return (
    <main className="howto-page">
      <div className="gl-head">
        <div className="gl-head-row">
          <h2 className="gl-head-title">Comment jouer</h2>
        </div>
        <div className="gl-rule" />
      </div>
      <div className="howto-body" data-scrolllock-allow>
        <p className="howto-lead">Règles officielles du One Piece Card Game</p>
        <ol className="howto-list">
          {SECTIONS.map((s) => (
            <li key={s.n} className="howto-card">
              <span className="howto-num">{s.n}</span>
              <h3 className="howto-title">{s.title}</h3>
              <p className="howto-text">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="list-end-pad" aria-hidden />
      </div>
      <div className="studio-float">
        <Link to="/" className="studio-float-save" aria-label="Retour">
          Retour
        </Link>
      </div>
    </main>
  );
}
