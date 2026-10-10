# The broadleaf trees (big-leaf maple and red alder), built in Blender through the Blender MCP.
# Exec this file, then call build_all(). Same recipe as trees.py: vertex colours only, chunky
# low-poly shapes, sunlit tops and shaded undersides. Crowns are made of overlapping, softly
# jittered puffs of leaves (bright and warm on top, deep green below) sitting on visible limbs.
# Each tree is two objects named Bark and Leaves, grounded at the origin, 1 unit = 1 m, Z up
# (Y up after glTF export). Every tree has a detailed and a cheap distant version.
import math
import random
import os
import sys
import bpy
import bmesh
from mathutils import Vector, Euler, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import hexc, lerp, make_material, Piece, tri_count  # noqa: E402

SPECIES = {
    # wide, mossy, low-forking old tree with an enormous rounded crown
    'bigleaf-maple': dict(
        height=12, kind='maple', seed=12,
        trunk=0.55, fork=0.26, limbs=4, lean=0.5,
        crown_rx=4.8, crown_rz=0.34, crown_z=0.60, puffs=34, puff=(1.9, 2.8), clear=0.25,
        dark=hexc('#2f5f2a'), mid=hexc('#5a9a34'), tip=hexc('#c2cf4e'), alt=hexc('#7fb040'),
        bark=hexc('#7a6650'), bark_dark=hexc('#4b3d30'), moss=hexc('#5f8f30'), moss_amount=0.4,
    ),
    # slim, pale-barked upright tree with a narrow oval crown
    'red-alder': dict(
        height=13, kind='alder', seed=33,
        trunk=0.24, fork=0.0, limbs=0, lean=0.35,
        crown_rx=2.6, crown_rz=0.40, crown_z=0.63, puffs=30, puff=(1.25, 1.85), clear=0.30,
        dark=hexc('#33663a'), mid=hexc('#5a9a52'), tip=hexc('#a9d070'), alt=hexc('#78b060'),
        bark=hexc('#d3cbbb'), bark_dark=hexc('#8c8576'), moss=hexc('#7d9a5a'), moss_amount=0.08,
    ),
}


def _variant(base, **over):
    spec = dict(SPECIES[base])
    spec.update(over)
    return spec


SPECIES.update({
    'bigleaf-maple-b': _variant('bigleaf-maple', seed=44, crown_rx=3.7, puffs=32, fork=0.34, limbs=3,
                                lean=0.8, crown_z=0.66, mid=hexc('#64a238')),
    'bigleaf-maple-c': _variant('bigleaf-maple', seed=57, crown_rx=5.0, puffs=38, fork=0.22, limbs=5,
                                lean=0.35, crown_z=0.60, trunk=0.62, moss_amount=0.55),
    'red-alder-b': _variant('red-alder', seed=45, crown_rx=2.1, puffs=26, lean=0.6, crown_z=0.66),
    'red-alder-c': _variant('red-alder', seed=68, crown_rx=2.9, puffs=32, clear=0.26, lean=0.25,
                            mid=hexc('#63a45a')),
})


def lean_at(spec, f):
    return math.sin(f * 2.2 + spec['seed']) * spec['lean'] * f * spec['height'] * 0.08


def tube(p, pts, radii, sides, colour, uv_scale=3.0):
    """A tapered tube along a polyline. `colour(i, k)` picks each corner's colour."""
    rings, travelled = [], 0.0
    for i, (c, r) in enumerate(zip(pts, radii)):
        if i:
            travelled += (pts[i] - pts[i - 1]).length
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 1, 0))
        u = d.cross(ref).normalized()
        v = d.cross(u)
        ring = []
        for k in range(sides + 1):
            a = k / sides * math.tau
            rr = r * (1.08 if k % 2 == 0 else 0.92)
            ring.append(p.vert(c + (u * math.cos(a) + v * math.sin(a)) * rr, colour(i, k),
                               uv=(k / sides, travelled / uv_scale)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(sides):
            p.face([rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]])


def puff(p, centre, radius, squash, rng, base, tip, subdiv, jitter):
    """One soft cluster of leaves: a flattened, jittered ball, dark underneath and bright on top."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    made = {}
    sx, sy = rng.uniform(0.9, 1.35), rng.uniform(0.9, 1.35)
    spin = Euler((0, 0, rng.uniform(0, math.tau))).to_matrix()
    for v in bm.verts:
        n = v.co.normalized()
        j = 1.0 + rng.uniform(-jitter, jitter)
        pos = Vector((n.x * radius * sx * j, n.y * radius * sy * j, n.z * radius * squash * j)) + centre
        pos = centre + spin @ (pos - centre)
        up = (n.z + 1) / 2
        col = lerp(base, tip, (up ** 1.1) * rng.uniform(0.75, 1.15))
        made[v] = p.vert(pos, col)
    for f in bm.faces:
        p.face([made[v] for v in f.verts])
    bm.free()


def build_tree(name, spec, distant, collection, bark_mat, leaf_mat):
    rng = random.Random(spec['seed'] + (1000 if distant else 0))
    bark, leaves = Piece(name + '_bark'), Piece(name + '_leaves')
    h, maple = spec['height'], spec['kind'] == 'maple'
    sides = 5 if distant else 8
    stations = 5 if distant else 9

    def bark_colour(i, k, f):
        base = lerp(spec['bark_dark'], spec['bark'], 0.5 + 0.5 * (1 - f))
        if maple:
            # moss creeps up the damp side of the trunk in patches
            patch = random.Random(spec['seed'] * 977 + i * 31 + k).random()
            if patch < spec['moss_amount'] * (1.1 - 0.5 * f):
                return lerp(base, spec['moss'], 0.85)
        else:
            # pale, smooth bark with dark horizontal marks
            if (i + k) % 3 == 0:
                return lerp(base, spec['bark_dark'], 0.5)
        return base

    # trunk
    top = h * (spec['fork'] if maple else 0.86)
    pts = [Vector((lean_at(spec, (top * i / (stations - 1)) / h), 0, top * i / (stations - 1)))
           for i in range(stations)]
    radii = [spec['trunk'] * (1 - 0.35 * i / (stations - 1)) * (1 + 0.7 * math.exp(-pts[i].z / 0.5))
             if maple else
             spec['trunk'] * (1 - 0.8 * (i / (stations - 1)) ** 1.1) * (1 + 0.5 * math.exp(-pts[i].z / 0.45))
             for i in range(stations)]
    tube(bark, pts, radii, sides,
         lambda i, k: bark_colour(i, k, i / (stations - 1)), uv_scale=3.0)

    # the crown volume the puffs fill
    cz = h * spec['crown_z']
    rx = spec['crown_rx']
    rz = h * spec['crown_rz']
    centre = Vector((lean_at(spec, spec['crown_z']), 0, cz))
    fork_pt = pts[-1]

    if maple:
        # big limbs sweep out from the fork toward the crown, drooping slightly at the ends
        for i in range(spec['limbs']):
            a = i / spec['limbs'] * math.tau + rng.uniform(-0.3, 0.3)
            target = centre + Vector((math.cos(a) * rx * 0.6, math.sin(a) * rx * 0.6, rng.uniform(-0.4, 0.8)))
            mid = (fork_pt + target) / 2 + Vector((0, 0, 0.9))
            limb_pts = [fork_pt, fork_pt.lerp(mid, 0.6), mid, mid.lerp(target, 0.6), target]
            limb_r = [spec['trunk'] * 0.62, spec['trunk'] * 0.5, spec['trunk'] * 0.38,
                      spec['trunk'] * 0.25, spec['trunk'] * 0.12]
            tube(bark, limb_pts, limb_r, 5 if distant else 6,
                 lambda i2, k, i=i: lerp(spec['bark_dark'], spec['bark'], 0.55 + 0.1 * (k % 2)),
                 uv_scale=3.0)
    else:
        # the alder's trunk carries on up through the crown, with a few short side limbs
        cont = [Vector((lean_at(spec, z / h), 0, z)) for z in (top, h * 0.93, h * 0.98)]
        tube(bark, [pts[-1], cont[1], cont[2]], [radii[-1], spec['trunk'] * 0.12, 0.03], sides,
             lambda i, k: lerp(spec['bark_dark'], spec['bark'], 0.6))
        for _ in range(0 if distant else 5):
            z = rng.uniform(h * spec['clear'], h * 0.82)
            a = rng.uniform(0, math.tau)
            start = Vector((lean_at(spec, z / h), 0, z))
            end = start + Vector((math.cos(a) * rx * 0.55, math.sin(a) * rx * 0.55, rng.uniform(0.4, 1.2)))
            tube(bark, [start, start.lerp(end, 0.5) + Vector((0, 0, 0.2)), end],
                 [spec['trunk'] * 0.3, spec['trunk'] * 0.2, 0.04], 5,
                 lambda i, k: lerp(spec['bark_dark'], spec['bark'], 0.5))

    # leaf puffs: sampled over the crown, favouring the outside so the crown reads as a round mass
    subdiv = 0 if distant else 1
    count = int(spec['puffs'] * (0.62 if distant else 1.0))
    lo, hi = spec['puff']
    placed = 0
    attempts = 0
    while placed < count and attempts < count * 20:
        attempts += 1
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        f = 0.35 + 0.65 * rng.random() ** 0.6
        pos = centre + Vector((d.x * rx * f, d.y * rx * f, d.z * rz * f))
        if pos.z < h * spec['clear']:
            continue
        up = (pos.z - (cz - rz)) / (2 * rz)
        up = max(0.0, min(1.0, up))
        radius = rng.uniform(lo, hi) * (0.8 + 0.3 * f) * (1.15 if distant else 1.0)
        base = lerp(spec['dark'], spec['mid'], 0.25 + 0.5 * up)
        if rng.random() < 0.25:
            base = lerp(base, spec['alt'], 0.6)
        tip = lerp(spec['mid'], spec['tip'], 0.45 + 0.55 * up)
        puff(leaves, pos, radius, 0.74, rng, base, tip, subdiv, 0.24)
        placed += 1

    bark_ob = bark.finish(collection, bark_mat, shade=True)
    leaf_ob = leaves.finish(collection, leaf_mat, shade=True)
    # settle the tree to its design height: the tallest leaf or twig is exactly `height` up
    tallest = max((o.matrix_world @ Vector(c)).z for o in (bark_ob, leaf_ob) for c in o.bound_box)
    scale = h / tallest
    for ob in (bark_ob, leaf_ob):
        ob.data.transform(Matrix.Scale(scale, 4))
    bark_ob.name, leaf_ob.name = name + '.Bark', name + '.Leaves'
    return bark_ob, leaf_ob


def build_all(only=None):
    for o in list(bpy.data.objects):
        if o.name.startswith(('bigleaf-maple', 'red-alder')):
            bpy.data.objects.remove(o, do_unlink=True)
    col = bpy.data.collections.get("deciduous") or bpy.data.collections.new("deciduous")
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    for stale in ("Bark", "Leaves", "Bark_mat", "Leaves_mat"):
        if stale in bpy.data.materials:
            bpy.data.materials.remove(bpy.data.materials[stale])
    bark_mat = make_material("Bark"); bark_mat.name = "Bark"
    leaf_mat = make_material("Leaves"); leaf_mat.name = "Leaves"
    # different roughness keeps the glTF import step from merging the two materials into one
    bark_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    leaf_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    info = {}
    for name, spec in SPECIES.items():
        if only and name != only:
            continue
        for distant in (False, True):
            full = name + ('-distant' if distant else '')
            b, l = build_tree(full, spec, distant, col, bark_mat, leaf_mat)
            top = max((o.matrix_world @ Vector(c)).z for o in (b, l) for c in o.bound_box)
            info[full] = {"tris": tri_count(b) + tri_count(l), "top": round(top, 2)}
    return info


def export_all(folder):
    """Write every tree as its own glTF (Bark and Leaves together, at the origin) into `folder`."""
    os.makedirs(folder, exist_ok=True)
    written = []
    for name in SPECIES:
        for suffix in ('', '-distant'):
            full = name + suffix
            bpy.ops.object.select_all(action='DESELECT')
            for part in ('.Bark', '.Leaves'):
                ob = bpy.data.objects[full + part]
                ob.location = (0, 0, 0)
                ob.select_set(True)
                bpy.context.view_layer.objects.active = ob
            bpy.ops.export_scene.gltf(filepath=os.path.join(folder, full + '.gltf'), use_selection=True,
                                      export_format='GLTF_SEPARATE', export_yup=True, export_apply=True)
            written.append(full)
    return written
