# The three conifers (Douglas-fir, western redcedar, Sitka spruce), built in Blender through the
# Blender MCP. Exec this file, then call build_all(). Each species gets a detailed tree and a cheap
# distant one. Chunky, storybook layered boughs: a thick tapered trunk with a flared base, then tiers
# of spade-shaped boughs whose tops catch the light (bright, warm tips) and whose undersides sit in
# shadow, so the crown reads as soft layered masses from far away and up close.
# Each tree is two objects named Bark and Leaves (the game paints the bark and tints the leaves for
# the seasons by those names), grounded at the origin, 1 unit = 1 m, Z up (Y up after glTF export).
# The heights match packages/shared PROP_KINDS: fir 14 m, cedar 12 m, spruce 16 m.
import math
import random
import os
import sys
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import hexc, lerp, make_material, Piece, tri_count  # noqa: E402

SPECIES = {
    'douglas-fir': dict(
        height=14, reach=3.3, levels=20, branches=12, trunk=0.32, first=0.27, span=0.66, power=0.7, segs=3,
        droop=0.32, lift=0.12, width=0.62, thick=0.36, style='fir', seed=21,
        dark=hexc('#1f5236'), mid=hexc('#2f7a43'), tip=hexc('#8fc152'),
        bark=hexc('#8a5a34'), bark_dark=hexc('#5a3a22'),
    ),
    'western-redcedar': dict(
        height=12, reach=3.5, levels=16, branches=10, trunk=0.36, first=0.13, span=0.80, power=0.65, segs=3,
        droop=0.50, lift=0.10, width=0.66, thick=0.34, style='cedar', seed=34,
        dark=hexc('#235a3c'), mid=hexc('#3a8a4a'), tip=hexc('#a6cf5c'),
        bark=hexc('#a8603c'), bark_dark=hexc('#6a3a28'),
    ),
    'sitka-spruce': dict(
        height=16, reach=3.0, levels=23, branches=12, trunk=0.40, first=0.20, span=0.76, power=0.75, segs=3,
        droop=0.26, lift=0.12, width=0.58, thick=0.34, style='spruce', seed=47,
        dark=hexc('#1a4a46'), mid=hexc('#2b7468'), tip=hexc('#79b86a'),
        bark=hexc('#7a6458'), bark_dark=hexc('#4a3c34'),
    ),
}


# Two more shapes per species so a forest is not one tree stamped out many times. The game picks
# one per tree (see prop-models.ts); the base file name is variant "a", then "-b" and "-c".
def _variant(base, **over):
    spec = dict(SPECIES[base])
    spec.update(over)
    return spec


SPECIES.update({
    # a slim, tall-trunked fir with a leaning crown
    'douglas-fir-b': _variant('douglas-fir', reach=2.6, levels=22, branches=10, first=0.36, span=0.58,
                              width=0.55, droop=0.22, lean=0.5, seed=62,
                              mid=hexc('#35804a'), tip=hexc('#9ccb58')),
    # a broad, old fir that keeps its lower limbs
    'douglas-fir-c': _variant('douglas-fir', reach=3.9, levels=17, branches=12, first=0.17, span=0.74,
                              width=0.68, droop=0.40, lean=0.3, seed=83, thick=0.40,
                              dark=hexc('#1b4a34'), mid=hexc('#296f44')),
    # an upright cedar with gently drooping boughs
    'western-redcedar-b': _variant('western-redcedar', reach=2.9, levels=17, branches=9, first=0.22, span=0.70,
                                   droop=0.34, width=0.60, lean=0.3, seed=71,
                                   mid=hexc('#3f9250'), tip=hexc('#b3d862')),
    # a wide, heavy, sweeping cedar that rests on the ground
    'western-redcedar-c': _variant('western-redcedar', reach=4.2, levels=15, branches=11, first=0.07, span=0.82,
                                   droop=0.62, width=0.72, lean=0.45, seed=95, thick=0.38),
    # a narrow spire with a long clear trunk
    'sitka-spruce-b': _variant('sitka-spruce', reach=2.5, levels=24, branches=10, first=0.32, span=0.64,
                               width=0.52, droop=0.32, lean=0.35, seed=58,
                               dark=hexc('#1d5250'), mid=hexc('#33806f')),
    # a broad, mature spruce with long lower limbs
    'sitka-spruce-c': _variant('sitka-spruce', reach=3.7, levels=21, branches=12, first=0.14, span=0.80,
                               width=0.62, droop=0.30, lean=0.25, seed=106, thick=0.38,
                               tip=hexc('#8ac26c')),
})


def lean_at(spec, f):
    """How far the trunk has drifted sideways at this fraction of its height."""
    return math.sin(f * 2.4 + spec['seed']) * spec.get('lean', 0.07) * f * spec['height'] * 0.1


def trunk(p, spec, distant):
    sides = 5 if distant else 9
    h = spec['height']
    top = h * 0.93
    stations = 5 if distant else 9
    r0 = spec['trunk']
    for s in range(stations):
        f = s / (stations - 1)
        y = f * top
        # a hair of lean so no two trunks stand like pillars, and a root flare at the foot
        lean = lean_at(spec, y / h)
        r = r0 * (1 - f) ** 1.15 * (1 + 0.6 * math.exp(-y / 0.55)) + 0.025
        for k in range(sides + 1):
            a = k / sides * math.tau
            furrow = 0.9 if k % 2 else 1.0
            rr = r * (1.06 if k % 2 == 0 else 0.94)
            col = lerp(spec['bark_dark'], spec['bark'], 0.55 + 0.45 * (1 - f) * furrow)
            p.vert((math.cos(a) * rr + lean, math.sin(a) * rr, y), col, uv=(k / sides, y / 3.0))
    ring = sides + 1
    verts = list(p.bm.verts)
    for s in range(stations - 1):
        for k in range(sides):
            a = verts[s * ring + k]
            b = verts[s * ring + k + 1]
            c = verts[(s + 1) * ring + k + 1]
            d = verts[(s + 1) * ring + k]
            p.face([a, b, c, d])
    return top


def bough(p, spec, origin, angle, extent, t, rng, distant, shade_var):
    """One spade-shaped bough: a ridge-topped slab that droops toward its tip."""
    segs = 2 if distant else spec.get('segs', 4)
    d = Vector((math.cos(angle), math.sin(angle), 0))
    side = Vector((-math.sin(angle), math.cos(angle), 0))
    wmax = extent * spec['width'] * rng.uniform(0.9, 1.1) * (1.4 if distant else 1.0)
    thick = spec['thick'] * (0.6 + 0.6 * extent / spec['reach'])
    stations = []
    for s in range(segs + 1):
        f = s / segs
        pos = origin + d * (extent * f)
        pos.z += -extent * spec['droop'] * f ** 1.7 + extent * spec['lift'] * f * (1 - f)
        pos.z = max(pos.z, 0.08)  # the lowest boughs rest on the ground instead of sinking into it
        # widest a little before the middle, pointed at the tip
        w = wmax * math.sin(math.pi * min(1.0, 0.18 + 0.82 * f * 0.92)) ** 0.9 * (1 - f) ** 0.35 if s < segs else 0.0
        if s == 0:
            w = wmax * 0.12
        h = thick * math.sin(math.pi * min(1.0, f * 0.9 + 0.05)) if s < segs else 0.0
        stations.append((pos, w, h))
    dark, mid, tip = spec['dark'], spec['mid'], spec['tip']
    lvl = lerp(dark, mid, 0.25 + 0.5 * t)
    verts_top = []
    verts_under = []
    for s, (pos, w, h) in enumerate(stations):
        f = s / segs
        c_top = lerp(lerp(lvl, mid, 0.5), tip, (f ** 1.4) * (0.5 + 0.5 * t) * shade_var)
        c_edge = lerp(lvl, mid, f * 0.9)
        c_under = tuple(x * 0.5 for x in lerp(dark, mid, f * 0.6))
        if s == segs:
            v = p.vert(pos + Vector((0, 0, h)), lerp(c_top, tip, 0.6))
            verts_top.append((v, v, v))
            u = p.vert(pos, c_under)
            verts_under.append((u, u))
        else:
            l = p.vert(pos - side * w, c_edge)
            c = p.vert(pos + Vector((0, 0, h)), c_top)
            r = p.vert(pos + side * w, c_edge)
            verts_top.append((l, c, r))
            verts_under.append((p.vert(pos - side * w, c_under), p.vert(pos + side * w, c_under)))
    for s in range(segs):
        (l0, c0, r0), (l1, c1, r1) = verts_top[s], verts_top[s + 1]
        (ul0, ur0), (ul1, ur1) = verts_under[s], verts_under[s + 1]
        if s == segs - 1:
            p.face([l0, c0, c1]); p.face([c0, r0, c1])
            p.face([ul0, ul1, ur0])
        else:
            p.face([l0, c0, c1, l1]); p.face([c0, r0, r1, c1])
            p.face([ul0, ul1, ur1, ur0])


def build_tree(name, spec, distant, collection, bark_mat, leaf_mat):
    rng = random.Random(spec['seed'] + (1000 if distant else 0))
    bark, leaves = Piece(name + '_bark'), Piece(name + '_leaves')
    h = spec['height']
    top = trunk(bark, spec, distant)
    levels = max(7, spec['levels'] // 2) if distant else spec['levels']
    branches = 7 if distant else spec['branches']
    for level in range(levels):
        t = level / (levels - 1)
        y = h * (spec['first'] + t * spec['span'])
        base_reach = spec['reach'] * max(0.07, (1 - t * 0.92)) ** spec['power']
        # one bough in eight is missing and the rest vary, so tiers never stack like cones
        phase = level * 1.19 + rng.uniform(-0.15, 0.15)
        for b in range(branches):
            ragged = t < 0.14 and rng.random() < 0.4  # the lowest tier is patchy, so the trunk shows through
            if ragged or (not distant and (b + level * 3) % 11 == 0):
                continue
            angle = phase + b / branches * math.tau + rng.uniform(-0.18, 0.18)
            extent = base_reach * rng.uniform(0.82, 1.12) * (rng.uniform(0.55, 0.95) if t < 0.14 else 1.0)
            lean = lean_at(spec, y / h)
            origin = Vector((lean, 0, y))
            bough(leaves, spec, origin, angle, extent, t, rng, distant, rng.uniform(0.55, 1.35))
    # the leader: a slim, bright spire that reaches exactly the tree's height
    sides = 4 if distant else 5
    base_y = h * 0.93
    ring = []
    for k in range(sides):
        a = k / sides * math.tau + 0.4
        ring.append(leaves.vert((math.cos(a) * 0.26 + lean_at(spec, 0.93), math.sin(a) * 0.26, base_y), lerp(spec['dark'], spec['mid'], 0.7)))
    apex = leaves.vert((lean_at(spec, 1.0), 0.0, h), lerp(spec['mid'], spec['tip'], 0.6))
    for k in range(sides):
        leaves.face([ring[k], ring[(k + 1) % sides], apex])
    bark_ob = bark.finish(collection, bark_mat, shade=True)
    leaf_ob = leaves.finish(collection, leaf_mat, shade=True)
    bark_ob.name, leaf_ob.name = name + '.Bark', name + '.Leaves'
    return bark_ob, leaf_ob


def build_all(only=None):
    for o in list(bpy.data.objects):
        if o.name.startswith(('douglas-fir', 'western-redcedar', 'sitka-spruce')):
            bpy.data.objects.remove(o, do_unlink=True)
    col = bpy.data.collections.get("trees") or bpy.data.collections.new("trees")
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    for stale in ("Bark", "Leaves", "Bark_mat", "Leaves_mat"):
        if stale in bpy.data.materials:
            bpy.data.materials.remove(bpy.data.materials[stale])
    # the game finds these two parts by material name, so keep them exactly Bark and Leaves
    bark_mat = make_material("Bark"); bark_mat.name = "Bark"
    leaf_mat = make_material("Leaves"); leaf_mat.name = "Leaves"
    # bark is fully matte, needles a touch softer; this also stops the glTF import step from
    # merging the two otherwise identical materials into one
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
            path = os.path.join(folder, full + '.gltf')
            bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format='GLTF_SEPARATE',
                                      export_yup=True, export_apply=True)
            written.append(full)
    return written
