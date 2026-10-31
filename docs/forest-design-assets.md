# Forest design assets

The approved forest-and-sage dashboard uses the real Balete photograph documented in [balete-background.md](balete-background.md). That photograph has not been regenerated for this design.

## Supporting assets

- `public/images/trashtrack-mark.webp`: transparent cutout of the supplied logo, optimized to 320 pixels wide. The original upload remains at `public/images/trashtrack-brand.png`.
- `public/images/collection-community.webp`: illustrative collection scene, 1200 × 900.
- `public/images/community-lakeside.webp`: illustrative community clean-up scene, 1800 × 600.

The two supporting scenes are generated brand imagery, not evidence of actual collections, residents’ reports, or named events. Report evidence and uploaded event/resource images continue to come from the application’s records.

All three assets were produced using the built-in image generation tool. WebP encoding and resizing only optimize delivery. The logo retains alpha transparency; its white background tile is removed.

## Generation prompts

### logo

Use case: background-extraction. Edit the supplied TrashTrack logo, preserving the actual artwork, colors, lettering, composition and proportions as closely as possible. Remove the white outer canvas AND the white rounded-square tile behind the artwork, including its grey drop shadow. Deliver the green truck, recycling symbol, bin, leaves, house motif, green wordmark and green swoosh artwork as a clean cutout on genuine alpha transparency. Preserve intentional white details INSIDE the truck cab and recycling symbol, not the surrounding white tile. Do not redesign, add text, create a different logo or add any new background. Clean antialiased edges, no white rectangle, no white halo, no checkerboard baked into the pixels. Centered full artwork, modest transparent margin.

### collection

Use case: photorealistic-natural. Generate a horizontal 4:3 supporting photograph for the approved TrashTrack admin design. A modest real-looking green municipal waste collection truck with a small white recycling symbol, parked on a tidy leafy barangay street in Batangas, Philippines, seen from behind at a slight angle. Two adult Filipino sanitation workers wearing simple green work shirts and gloves stand beside green wheeled bins. Lush tropical trees, everyday houses, natural warm late-afternoon light, documentary photography with real texture and realistic proportions. Calm community-care mood, clean composition, muted natural green palette. This is illustrative brand imagery, not evidence of a specific real collection. No legible plates, no words, no logos other than simple recycling symbol, no text overlay, no watermark, no frame. The truck should stay fully visible with comfortable crop margins.

### community

Use case: photorealistic-natural. Generate a very wide 3:1 panoramic supporting photograph for the TrashTrack admin event feature. Filipino adult community volunteers in simple forest-green shirts, work gloves and casual practical trousers, carefully collecting a small amount of litter with bags along a tree-shaded lakeside footpath in Batangas. Three to five people naturally working, authentic candid community cleanup atmosphere, lush trees at left and calm lake at right, warm late-afternoon sunlight, quiet earthy greens, realistic documentary photograph, visually attractive and respectful. Keep the RIGHT HALF mainly lake, soft trees and open space so the application can place dark text there using its own pale background. This is illustrative community imagery, not documentation of a named actual event. No uniforms with readable text, no signage, no fake municipal seal, no words, no captions, no watermark, no frame.
