"""
Builds the three pieces that line dug tunnels and pits
(decision 0114, step 5; assets/terrain/dug-wall-kit.glb).

Run it inside Blender (through the Blender MCP), then export the objects to a
glTF and compress it: `node tools/import-model.mjs <exported.gltf>
assets/terrain/dug-wall-kit.glb`.

Each piece fills one half-metre cell, 0 to 0.5 m on every axis, and is the
surface of the open air inside that cell with the solid ground on its LOW sides
(x = 0, y = 0, z = 0). Normals face the air.

  dug_panel  the floor: one flat wall (solid below, y = 0)
  dug_edge   solid below and behind (y = 0 and z = 0): a quarter-round along X,
             radius 0.5 m, centred on the far corner of the cell
  dug_dome   solid on all three low sides: an eighth of a sphere, radius 0.5 m,
             centred on the far corner of the cell

The radius is a whole cell, so four edge pieces make a perfectly round tunnel a
metre across and a dome closes a dead end. Neighbouring pieces meet in a smooth
line because every curve ends tangent to the flat wall next to it.

The game (apps/client/src/scene/dug-walls.ts) turns and mirrors these to fit
each cell. The pieces are authored with Y as "up" (the game's axis), so they are
rotated 90 degrees about X before export, which makes Blender's glTF exporter
(Y up) write them back out exactly as authored here.
"""

import math

import bmesh
import bpy
from mathutils import Vector

CELL = 0.5
RADIUS = 0.5


def make_object(name, verts, faces):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def grid(nu, nv, point, flip=False):
    verts, faces = [], []
    for i in range(nu + 1):
        for k in range(nv + 1):
            verts.append(point(i / nu, k / nv))
    for i in range(nu):
        for k in range(nv):
            a = i * (nv + 1) + k
            b, c, d = a + 1, a + (nv + 1) + 1, a + (nv + 1)
            faces.append((a, d, c, b) if flip else (a, b, c, d))
    return verts, faces


def panel(u, w):
    return (CELL * u, 0, CELL * w)


def edge(u, w):
    t = (math.pi / 2) * w
    return (CELL * u, RADIUS - RADIUS * math.cos(t), RADIUS - RADIUS * math.sin(t))


def dome(u, w):
    theta, phi = (math.pi / 2) * u, (math.pi / 2) * w
    return (
        RADIUS - RADIUS * math.sin(theta) * math.cos(phi),
        RADIUS - RADIUS * math.cos(theta),
        RADIUS - RADIUS * math.sin(theta) * math.sin(phi),
    )


kit = {
    "dug_panel": grid(6, 6, panel),
    "dug_edge": grid(2, 8, edge, flip=True),
    "dug_dome": grid(8, 8, dome),
}
for name, (verts, faces) in kit.items():
    obj = make_object(name, verts, faces)
    # Check every face looks towards the air inside the cell.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    centre = Vector((0.25, 0.25, 0.25))
    facing = sum(1 for f in bm.faces if (centre - f.calc_center_median()).dot(f.normal) > 0)
    assert facing == len(bm.faces), f"{name}: some faces look into the ground"
    bm.free()
    # Authored with Y up; Blender is Z up.
    obj.rotation_euler = (math.pi / 2, 0, 0)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
