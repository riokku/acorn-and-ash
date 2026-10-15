# Acorn & Ash icon

A single golden acorn with a brown cap on a consistent forest-green background,
generated with OpenAI image generation for the game’s browser tabs and saved
bookmarks. No flame, ember or forest scenery. This is website branding, separate
from the Blender models and textures used inside the game.

`acorn-source.png` is the generated source. Both HTML entry points reference the
exports here; Vite gives them content-hashed URLs on deployment. The source image
is not included in the client download.

The exports use an eight-colour palette for a simple silhouette and consistent
green background. Export with ImageMagick:

```sh
magick assets/branding/acorn-source.png -resize 180x180 -strip -dither None -colors 8 PNG8:assets/branding/apple-touch-icon.png
magick assets/branding/apple-touch-icon.png -filter Box -define icon:auto-resize=48,32,16 assets/branding/favicon.ico
```
