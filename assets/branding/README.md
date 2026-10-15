# Acorn & Ash icon

A glowing acorn and flame against forest green, generated with OpenAI image
generation for the game's browser tabs and saved bookmarks. This is website
branding, separate from the Blender models and textures used inside the game.

`acorn-ember-source.png` is the original transparent image. Both HTML entry points
reference the exports here; Vite gives them content-hashed URLs on deployment.
The source image is not included in the client download.

Export with ImageMagick:

```sh
magick assets/branding/acorn-ember-source.png -define icon:auto-resize=48,32,16 assets/branding/favicon.ico
magick assets/branding/acorn-ember-source.png -resize 180x180 -strip assets/branding/apple-touch-icon.png
```
