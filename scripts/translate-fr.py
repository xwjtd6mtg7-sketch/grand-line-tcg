#!/usr/bin/env python3
"""Rewrite catalog card.text into proper French. Keeps textEn for the rules parser."""
from __future__ import annotations

import json
from pathlib import Path

# Longest phrases first.
PHRASES: list[tuple[str, str]] = [
    ("This card can attack on the turn in which it is played.", "Cette carte peut attaquer le tour où elle est mise en jeu."),
    ("this card can attack on the turn in which it is played.", "cette carte peut attaquer le tour où elle est mise en jeu."),
    ("cette carte can attack on the turn in which it is played.", "cette carte peut attaquer le tour où elle est mise en jeu."),
    ("can attack on the turn in which it is played", "peut attaquer le tour où elle est mise en jeu"),
    ("Your opponent cannot activate [Blocker] during this battle.", "Votre adversaire ne peut pas activer [Bloqueur] pendant ce combat."),
    ("Votre adversaire cannot activate [Bloqueur] pour tout le combat.", "Votre adversaire ne peut pas activer [Bloqueur] pendant ce combat."),
    ("Votre adversaire cannot activate [Bloqueur] during this battle.", "Votre adversaire ne peut pas activer [Bloqueur] pendant ce combat."),
    ("cannot activate [Bloqueur] pour tout le combat", "ne peut pas activer [Bloqueur] pendant ce combat"),
    ("cannot activate [Blocker] during this battle", "ne peut pas activer [Bloqueur] pendant ce combat"),
    ("cannot activate [Bloqueur]", "ne peut pas activer [Bloqueur]"),
    ("cannot activate [Blocker]", "ne peut pas activer [Bloqueur]"),
    ("Your opponent cannot activate", "Votre adversaire ne peut pas activer"),
    ("until the start of your next turn", "jusqu'au début de votre prochain tour"),
    ("until the end of your opponent's next turn", "jusqu'à la fin du prochain tour de votre adversaire"),
    ("until the end of this turn", "jusqu'à la fin de ce tour"),
    ("at the end of this turn", "à la fin de ce tour"),
    ("at the start of your next turn", "au début de votre prochain tour"),
    ("during this battle", "pendant ce combat"),
    ("pour tout le combat", "pendant ce combat"),
    ("pour tout le tour", "pendant ce tour"),
    ("for this turn", "pendant ce tour"),
    ("Once Per Turn", "Une fois par tour"),
    ("une fois Per Turn", "Une fois par tour"),
    ("once Per Turn", "une fois par tour"),
    ("Per Turn", "par tour"),
    ("Activate: Main", "Activation : Principale"),
    ("[Activate: Main]", "[Activation : Principale]"),
    ("[On Play]", "[Jouée]"),
    ("[On K.O.]", "[En cas de KO]"),
    ("[On KO]", "[En cas de KO]"),
    ("[When Attacking]", "[En attaquant]"),
    ("[When Blocking]", "[En bloquant]"),
    ("[On Block]", "[En bloquant]"),
    ("[Your Turn]", "[Pendant votre tour]"),
    ("[Opponent's Turn]", "[Pendant le tour de l'adversaire]"),
    ("[End of Your Turn]", "[Fin de votre tour]"),
    ("[On Your Opponent's Attack]", "[Quand votre adversaire attaque]"),
    ("If you have", "Si vous avez"),
    ("If your opponent has", "Si votre adversaire a"),
    ("If Votre adversaire has", "Si votre adversaire a"),
    ("If your Leader has", "Si votre Leader a"),
    ("If this Character", "Si ce Personnage"),
    ("You may rest", "Vous pouvez reposer"),
    ("You may add", "Vous pouvez ajouter"),
    ("You may trash", "Vous pouvez défausser"),
    ("You may play", "Vous pouvez jouer"),
    ("You may draw", "Vous pouvez piocher"),
    ("You can", "Vous pouvez"),
    ("You may", "Vous pouvez"),
    ("your opponent's", "de votre adversaire"),
    ("Your opponent's", "De votre adversaire"),
    ("Votre adversaire has", "votre adversaire a"),
    ("your opponent", "votre adversaire"),
    ("Your opponent", "Votre adversaire"),
    ("this Character", "ce Personnage"),
    ("This Character", "Ce Personnage"),
    ("ce Personnage gains", "ce Personnage gagne"),
    ("this Leader", "ce Leader"),
    ("This Leader", "Ce Leader"),
    ("this card", "cette carte"),
    ("This card", "Cette carte"),
    ("cette carte gains", "cette carte gagne"),
    ("from your hand", "de votre main"),
    ("from your trash", "de votre poubelle"),
    ("from your deck", "de votre deck"),
    ("from your Life", "de votre Vie"),
    ("à votre main", "à votre main"),
    ("to your hand", "à votre main"),
    ("to your trash", "dans votre poubelle"),
    ("to the trash", "dans la poubelle"),
    ("in your trash", "dans votre poubelle"),
    ("in your hand", "dans votre main"),
    ("in play", "en jeu"),
    ("in battle", "en combat"),
    ("with a cost of", "ayant un coût de"),
    ("ayant un coût de", "ayant un coût de"),
    ("or less", "ou moins"),
    ("or more", "ou plus"),
    ("ou moins", "ou moins"),
    ("without a Counter", "sans Contre"),
    ("type Character cards", "cartes Personnage de type"),
    ("type Character card", "carte Personnage de type"),
    ("type Character", "Personnage de type"),
    ("de type cartes Personnage", "cartes Personnage de type"),
    ("de type Personnage", "Personnage de type"),
    ("Character cards", "cartes Personnage"),
    ("Character card", "carte Personnage"),
    ("Characters", "Personnages"),
    ("Character", "Personnage"),
    ("DON!! cards", "cartes DON!!"),
    ("DON!! card", "carte DON!!"),
    ("rested DON!!", "DON!! reposé"),
    ("active DON!!", "DON!! actif"),
    ("Life cards", "cartes Vie"),
    ("Life card", "carte Vie"),
    ("cannot be K.O.'d", "ne peut pas être mis K.O."),
    ("cannot be KO'd", "ne peut pas être mis K.O."),
    ("K.O.'d", "mis K.O."),
    ("KO'd", "mis K.O."),
    ("gains [", "gagne ["),
    ("gain [", "gagnent ["),
    ("gains +", "gagne +"),
    ("gain +", "gagnent +"),
    ("gains ", "gagne "),
    ("Give this", "Donnez à ce"),
    ("Give up to", "Donnez jusqu'à"),
    ("Give ", "Donnez "),
    ("Add up to", "Ajoutez jusqu'à"),
    ("Add ", "Ajoutez "),
    ("Play up to", "Jouez jusqu'à"),
    ("Play ", "Jouez "),
    ("Draw ", "Piochez "),
    ("draw ", "piochez "),
    ("Trash ", "Défaussez "),
    ("trash ", "défaussez "),
    ("Rest ", "Reposez "),
    ("rest ", "reposez "),
    ("Set as active", "Redressez"),
    ("Set ", "Placez "),
    ("Place ", "Placez "),
    ("Look at", "Regardez"),
    ("Return ", "Renvoyez "),
    ("Reveal ", "Révélez "),
    ("Choose ", "Choisissez "),
    ("Select ", "Choisissez "),
    ("Then, ", "Puis, "),
    ("Then ", "Puis "),
    ("If ", "Si "),
    ("When ", "Quand "),
    ("After ", "Après "),
    ("up to ", "jusqu'à "),
    ("of your ", "de vos "),
    ("of your", "de vos"),
    ("your ", "votre "),
    ("a cost of ", "un coût de "),
    ("power", "puissance"),
    ("cards", "cartes"),
    ("card", "carte"),
    ("cannot", "ne peut pas"),
    ("can also attack", "peut aussi attaquer"),
    ("can also", "peut aussi"),
    ("can ", "peut "),
    ("has 2 ou moins", "a 2 ou moins"),
    ("has a ", "a un(e) "),
    ("has the ", "a le "),
    ("according to the rules", "selon les règles"),
    ("On Play", "Jouée"),
    ("On K.O.", "En cas de KO"),
    ("When Attacking", "En attaquant"),
    ("Once per turn", "Une fois par tour"),
    ("Blocker", "Bloqueur"),
    ("Rush", "Initiative"),
    ("Double Attack", "Double attaque"),
]


def translate(text: str) -> str:
    if not text:
        return text
    out = text
    for a, b in PHRASES:
        out = out.replace(a, b)
    # leftover mixed bits
    out = out.replace("You ", "Vous ")
    out = out.replace(" you ", " vous ")
    out = out.replace("If you ", "Si vous ")
    out = out.replace("Per Turn", "par tour")
    out = out.replace("per turn", "par tour")
    out = out.replace("During this battle", "Pendant ce combat")
    out = out.replace("during this battle", "pendant ce combat")
    out = out.replace("this battle", "ce combat")
    out = out.replace("this turn", "ce tour")
    out = out.replace("next turn", "prochain tour")
    out = out.replace("active Personnages", "Personnages actifs")
    out = out.replace("actif Personnages", "Personnages actifs")
    out = out.replace("de votre adversaire actif Personnages", "les Personnages actifs de votre adversaire")
    out = out.replace("peut aussi attack", "peut aussi attaquer")
    out = out.replace(" can ", " peut ")
    out = out.replace(" cannot ", " ne peut pas ")
    return out


def main() -> None:
    path = Path("/workspace/public/data/catalog.json")
    data = json.loads(path.read_text())
    n = 0
    for c in data["cards"]:
        src = c.get("textEn") or c.get("text") or ""
        if not src:
            continue
        # Always translate from English original when present
        base = c.get("textEn") or c.get("text")
        fr = translate(base)
        if c.get("text") != fr:
            c["text"] = fr
            n += 1
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    # verify sample
    s = next(x for x in data["cards"] if x["id"] == "ST01-012")
    print("updated", n)
    print("ST01-012:", s["text"])


if __name__ == "__main__":
    main()
