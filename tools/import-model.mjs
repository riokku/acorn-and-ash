// Imports a single glTF model from a CC0 pack, drops any texture slot whose
// image file wasn't shipped with it (we skip huge normal maps when pulling
// assets down — see docs/decisions on the first art pass), and writes an
// optimized, Meshopt-compressed .glb. Run with: node tools/import-model.mjs
// <input.gltf> <output.glb>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune, reorder, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("usage: node tools/import-model.mjs <input.gltf> <output.glb>");
  process.exit(1);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });

// A .gltf's external images all get loaded eagerly on read, so a texture
// slot pointing at a file we didn't ship (a dropped normal map) needs a
// stand-in on disk before gltf-transform can even open the document.
const doc = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(inputPath, "utf8")));
const dir = dirname(resolve(inputPath));
const placeholders = [];
for (const image of doc.images ?? []) {
  if (image.uri && !existsSync(resolve(dir, decodeURIComponent(image.uri)))) {
    const target = resolve(dir, decodeURIComponent(image.uri));
    mkdirSync(dirname(target), { recursive: true });
    // Smallest possible valid PNG (1x1 transparent), just to satisfy the reader.
    writeFileSync(
      target,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    placeholders.push(target);
  }
}

const document = await io.read(inputPath);

let strippedCount = 0;
for (const material of document.getRoot().listMaterials()) {
  if (material.getNormalTexture()) {
    material.setNormalTexture(null);
    strippedCount++;
  }
}
if (strippedCount > 0) {
  console.log(`stripped ${strippedCount} normal-texture reference(s) with no source file`);
}

await document.transform(prune(), dedup(), weld(), reorder({ encoder: MeshoptEncoder }));

const meshopt = document.createExtension(EXTMeshoptCompression).setRequired(true);
void meshopt;

let triangles = 0;
for (const mesh of document.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const indices = primitive.getIndices();
    const position = primitive.getAttribute("POSITION");
    triangles += (indices ? indices.getCount() : position.getCount()) / 3;
  }
}
console.log(`${inputPath} -> ${outputPath}: ${Math.round(triangles)} triangles`);

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
await io.write(outputPath, document);

for (const file of placeholders) {
  await import("node:fs/promises").then((fs) => fs.unlink(file));
}
