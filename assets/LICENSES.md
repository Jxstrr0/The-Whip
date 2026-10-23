# Third-party assets

Everything under `assets/` is CC0 or OFL and listed here with its source. Nothing is fetched at runtime from anywhere but this repo and the Three.js CDN.

## Textures (`assets/textures/`)

All from **ambientCG** (https://ambientcg.com), licence **CC0 1.0 Universal** (https://docs.ambientcg.com/license/: "All ambientCG assets are provided under the Creative Commons CC0 1.0 Universal License."). Downloaded as `<ID>_1K-JPG.zip`, resized to 512² and re-encoded. `*_c.jpg` is the colour map, desaturated part-way and normalised to one brightness (so the vertex colour still carries the hue and a tint multiplies through); `*_n.jpg` is the OpenGL normal map; `*_r.jpg` is the roughness map normalised to a mean of 0.9 (`src/textures.js` scales it to each surface's roughness).

| File | ambientCG asset | Used for |
| --- | --- | --- |
| `carpet_c/n/r.jpg` | Fabric033 | the chamber carpet and the caucus table's baize |
| `oak_c/n/r.jpg` | Wood049 | oak panelling, desks, benches, tables, kit furniture |
| `walnut_c/n/r.jpg` | Wood051 | dark wood (the Speaker's chair, the whip's office) |
| `stone_c/n/r.jpg` | Tiles143 | the chamber's stone walls |
| `plaster_c/n/r.jpg` | Plaster001 | ceilings and plaster walls |
| `leather_n/r.jpg` | Leather037 | green leather (normal and roughness only; colour from the material) |
| `wool_c/n/r.jpg` | Carpet016 | office and caucus carpets, the cloth spines of kit books |
| `brass_n/r.jpg` | Metal034 | brushed brass and steel: rails, the Mace, nameplates, lamp stems, chair legs (no colour map; the hue is the material's) |
| `paper_c/n.jpg` | Paper001 | pages and pads in the rooms, and the fibre under every sheet of UI paper (`--grain` in `css/style.css`) |
| `card_c.jpg` | Paper002 | the index card you write replies on (`--card-grain`) |

## Fonts (`assets/fonts/`)

**Newsreader** by Production Type, from Google Fonts, licence **SIL Open Font License 1.1** (https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/OFL.txt: "This Font Software is licensed under the SIL Open Font License, Version 1.1."). `Newsreader-Regular.woff2` and `Newsreader-Italic.woff2` are the variable latin subsets served by Google Fonts (optical size and weight axes), fetched once and committed. It replaced Fraunces after playtesting, because Fraunces's Y and J were hard to read on a phone.

## Models (`assets/models/`)

### `furniture/` — Kenney Furniture Kit 2.0

From **Kenney** (https://kenney.nl/assets/furniture-kit), licence **CC0 1.0 Universal** (the pack's `License.txt`: "License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/"). Used as shipped (GLB, no textures; flat materials named `wood`, `metal`, `carpet` and so on, which `src/models.js` maps to the game's own surfaces). About 0.52 of real scale; the loader scales them.

Files: desk, chairDesk, chairCushion, loungeChair, loungeChairRelax, loungeSofa, loungeSofaLong, bookcaseClosedWide, bookcaseOpen, books, lampRoundTable, lampWall, pottedPlant, plantSmall2, coatRackStanding, computerScreen, laptop, trashcan, tableCross, kitchenCoffeeMachine.

### `street/` — KayKit City Builder Bits 1.0

From **KayKit** (https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits), licence **CC0 1.0 Universal** (the repo's `LICENSE.txt`: "License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/"). Used as shipped (glTF + bin + the shared `citybits_texture.png` atlas, which stays on the models). About 1:5 scale; the loader scales them.

Files: streetlight, bench, car_sedan, firehydrant, trash_A, bush.

### `food/` — Kenney Food Kit

From **Kenney** (https://kenney.nl/assets/food-kit), licence **CC0 1.0 Universal** (the pack's `License.txt`). Used as shipped (GLB + `Textures/colormap.png`, which stays on the models). About 2.4× real scale; the loader scales them down.

Files: bottle-oil (the water carafe), glass, cup-coffee, cup-saucer.
