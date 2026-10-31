# Balete background image quality

The login and dashboard now use the 2500 × 1565 original of the approved Balete photograph. The previous background was a 1585 × 992 generated edit, and the login requested an additional Next.js quality-75 encoding. Both reduced detail at large display sizes.

Source: [WOWBatangas original photograph](https://www.wowbatangas.com/wp-content/uploads/2025/07/Lakeside-Living-The-Quiet-Charm-of-Balete-Batangas-Mozzafiato1.jpg), from [Lakeside Living: The Quiet Charm of Balete, Batangas](https://www.wowbatangas.com/lakeside-living-the-quiet-charm-of-balete-batangas/).

The cleaned master preserves every original decoded pixel outside the small lower-right logo repair. The built-in image-generation tool repaired only a cropped logo patch; that patch was feathered into the original at its native resolution. No whole-image AI enlargement, blur, sharpening or color change was used.

Patch prompt: “Remove only the large blue-and-red WOWBATANGAS lettering. Inpaint the area occupied by the letters with a natural continuation of the trees, dark green foliage, shadows and small paved road below. Preserve the existing palm, trees, shrubs, shoreline at the top and paved road at the left; preserve photographic texture, exact warm late-afternoon lighting and muted color balance. Keep existing unlettered pixels and all edges stable for seamless compositing. Exact same framing and aspect ratio, no added words or objects.”

Production assets, encoded once as WebP at quality 95:

| Asset | Resolution | Size |
| --- | --- | --- |
| `public/images/balete-lakeside-hd.webp` | 2500 × 1565 | 1,404,788 bytes |
| `public/images/balete-lakeside-1920.webp` | 1920 × 1202 | 823,536 bytes |
| `public/images/balete-lakeside-1280.webp` | 1280 × 801 | 344,268 bytes |

The login, logout page, and dashboard header use native responsive picture sources and serve these files directly, avoiding another image-optimizer encoding. They load eagerly with high fetch priority. The login and logout `sizes` account for cover height on portrait screens. The logout photo stays sharp with no blur or backdrop-blur filter; its green fade is a separate color overlay. The dashboard header uses `sizes="100vw"` so collapsed navigation and high-density displays receive a sufficiently large source, up to the 2500-pixel original.

The header uses a taller scenic frame and an 18% vertical focal position to show the mountain, shoreline, and lake together. Display-only brightness, contrast, saturation, and a slight warm tint bring out the original sunset colors; a localized text overlay keeps the scene clear.

On wide logout screens, the photo covers the left 78% before blending into the forest background. This lets it show more of the original scene at a smaller scale, rather than enlarging the photo across the entire viewport. Tablet and mobile backgrounds retain full coverage. These presentation changes do not regenerate, stretch, blur, or alter the geography of the photograph.

The local lossless master is `D:/Trashtrack/output/balete-hd/balete-lakeside-hd-master.png`; browser and pixel-preservation verification are in the same output directory. Both application copies contain identical production assets and rendering changes.
