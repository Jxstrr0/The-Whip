# Third-party assets

Everything under `assets/` is CC0 or OFL and listed here with its source. Nothing is fetched at runtime from anywhere but this repo and the Three.js CDN.

## Textures (`assets/textures/`)

All from **ambientCG** (https://ambientcg.com), licence **CC0 1.0 Universal** (https://docs.ambientcg.com/license/: "All ambientCG assets are provided under the Creative Commons CC0 1.0 Universal License."). Downloaded as `<ID>_1K-JPG.zip`, resized to 512² and re-encoded. `*_c.jpg` is the colour map converted to a greyscale grain centred near 0.84 (the vertex colour carries the hue); `*_n.jpg` is the OpenGL normal map.

| File | ambientCG asset | Used for |
| --- | --- | --- |
| `carpet_c/n.jpg` | Fabric033 | the chamber carpet |
| `oak_c/n.jpg` | Wood049 | oak panelling, desks, benches, tables |
| `walnut_c/n.jpg` | Wood051 | dark wood (the Speaker's chair, the whip's office) |
| `stone_c/n.jpg` | Tiles143 | the chamber's stone walls |
| `plaster_c/n.jpg` | Plaster001 | ceilings and plaster walls |
| `leather_n.jpg` | Leather037 | green leather (normal map only; colour from the material) |
| `wool_c/n.jpg` | Carpet016 | office and caucus carpets |

## Fonts (`assets/fonts/`)

**Fraunces** by Undercase Type, from Google Fonts, licence **SIL Open Font License 1.1** (https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt: "This Font Software is licensed under the SIL Open Font License, Version 1.1."). `Fraunces-Regular.woff2` and `Fraunces-Italic.woff2` are the variable latin subsets served by Google Fonts (optical size and weight axes), fetched once and committed.

## Models (`assets/models/`)

### `furniture/` — Kenney Furniture Kit 2.0

From **Kenney** (https://kenney.nl/assets/furniture-kit), licence **CC0 1.0 Universal** (the pack's `License.txt`: "License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/"). Used as shipped (GLB, no textures; flat materials named `wood`, `metal`, `carpet` and so on, which `src/models.js` maps to the game's own surfaces). About 0.52 of real scale; the loader scales them.

Files: desk, chairDesk, chairCushion, loungeChair, loungeChairRelax, loungeSofa, loungeSofaLong, bookcaseClosedWide, bookcaseOpen, books, lampRoundTable, lampWall, pottedPlant, plantSmall2, coatRackStanding, computerScreen, laptop, trashcan, tableCross, kitchenCoffeeMachine.

### `street/` — KayKit City Builder Bits 1.0

From **KayKit** (https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits), licence **CC0 1.0 Universal** (the repo's `LICENSE.txt`: "License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/"). Used as shipped (glTF + bin + the shared `citybits_texture.png` atlas, which stays on the models). About 1:5 scale; the loader scales them.

Files: streetlight, bench, car_sedan, firehydrant, trash_A, bush.
