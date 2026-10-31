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

The login uses a native responsive picture source and serves these files directly, avoiding another image-optimizer encoding. Its `sizes` accounts for the image's cover height on portrait screens, so a tall phone screen does not receive a narrow low-resolution landscape. The background loads eagerly with high fetch priority. The dashboard uses the full-resolution asset directly.

The local lossless master is `D:/Trashtrack/output/balete-hd/balete-lakeside-hd-master.png`; browser and pixel-preservation verification are in the same output directory. Both application copies contain identical production assets and rendering changes.
