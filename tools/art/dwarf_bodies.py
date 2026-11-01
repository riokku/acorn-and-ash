# The six dwarf bodies (three men, three women) in plain clothes: a shirt, shorts and bare feet
# (decision 0112). Outfits, hats and capes are separate gear; beards are separate pieces too.
# Run inside Blender through the Blender MCP:
#
#     exec(open(r'<repo>/tools/art/dwarf_bodies.py').read())
#     build_lineup(BODIES)                  # all six side by side, arms relaxed
#     build_body(BODIES[0])                 # one body on the game's skeleton, T-pose
#     render_views(out_dir, 'tag', ...)     # preview pictures
#
# How the shapes are made: each part (head, hair, beard, torso, arms, legs) is sculpted from
# overlapping soft shapes (Blender metaballs) so the nose, cheeks and brow grow out of the face
# instead of being stuck on, then reduced (decimated) to a few hundred flat triangles. That gives
# the faceted, hand-cut look of the reference art. Eyes, teeth and brows are crisp small pieces.
# Colours are per-facet vertex colours with soft top-lit shading (decision 0107).
#
# Skin is on a material of its own, named '<id>_skin' and marked 'skin', so the game can lighten
# or darken it for the player's skin tone (decision 0113). Everything else is on '<id>_body'.
#
# Built on a copy of the game's skeleton (Rig_Medium: same 23 bone names and the same T-pose
# directions), with the bones moved to dwarf proportions, so existing moves can be reused by
# bone name. Parts are named like the current bodies: Body, ArmLeft, ArmRight, LegLeft, LegRight,
# Head (with its hair); the beard is its own Beard piece.
#
# 1 unit = 1 m at the Adventurers pack's native scale (the game draws characters at 0.6).
# Facing -Y, Z up, the left hand at +X.
import math
import os
import random
import subprocess
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

REPO = r'C:\Users\studi\OneDrive\Desktop\Projects\acorn-and-ash'
sys.path.insert(0, os.path.join(REPO, 'tools', 'art'))
from common import hexc  # noqa: E402

SHADE_DOWN, SHADE_UP = .8, 1.12
META_SURFACE = .57  # a lone metaball's surface sits at about 0.57 of its radius (threshold 0.6, stiffness 2)

# ---------------------------------------------------------------- the six bodies

BASE = dict(
    id='dwarf', label='Body', sex='m',
    skin='#f2b497', hair='#6b4430', eyes='#4a7ab0', blush='#e8806a', lips='#7a2d2a',
    shirt='#e6dcc4', shirt_trim='#c9bc9f', shorts='#6f7f8f', shorts_trim='#5b6a79',
    belly=1.0, shoulders=1.0, hips=1.0,
    nose='potato', nose_size=1.0, ears=1.0,
    eye_style='round', eye_size=1.0, brow_tilt=4, brow_size=1.0,
    mouth='gentle', hair_style='bald_tufts', beard_style='full', beard=None,
    freckles=False, lashes=False,
)

BODIES = [
    dict(BASE, id='dwarf1', label='Body 1', sex='m', skin='#f2b497', hair='#b0561f', eyes='#4a7ab0',
         nose='potato', nose_size=1.15, eye_style='round', brow_tilt=4, mouth='wide', hair_style='bald_tufts',
         beard_style='braids', belly=1.22, shirt='#e6dcc4', shirt_trim='#c9bc9f', shorts='#6f7f8f', shorts_trim='#5b6a79'),
    dict(BASE, id='dwarf2', label='Body 2', sex='f', skin='#eab08e', hair='#e3b85c', eyes='#5a8a4a',
         nose='button', nose_size=1.0, eye_style='wide', brow_tilt=-3, brow_size=.8, mouth='gentle', hair_style='braids',
         beard_style='none', freckles=True, lashes=True, belly=1.05, hips=1.12,
         shirt='#c65d4a', shirt_trim='#a84a3a', shorts='#7b6350', shorts_trim='#65503f'),
    dict(BASE, id='dwarf3', label='Body 3', sex='m', skin='#c58a64', hair='#3a2418', eyes='#6a4a30',
         nose='long', nose_size=1.1, eye_style='goofy', brow_tilt=-6, mouth='smirk', hair_style='messy',
         beard_style='long', belly=.92, shoulders=.92,
         shirt='#a59ac4', shirt_trim='#8a7eaa', shorts='#5d5470', shorts_trim='#4b435c'),
    dict(BASE, id='dwarf4', label='Body 4', sex='f', skin='#8d5a3a', hair='#2a1d18', eyes='#6a4a30', blush='#b85c4a',
         nose='button', nose_size=.85, eye_style='wide', eye_size=1.12, brow_tilt=-2, brow_size=.8, mouth='small',
         hair_style='bun', beard_style='none', lashes=True, belly=.95,
         shirt='#a9c6d8', shirt_trim='#8eaec3', shorts='#b49c78', shorts_trim='#9a8262'),
    dict(BASE, id='dwarf5', label='Body 5', sex='m', skin='#6e4530', hair='#1f1712', eyes='#4a3020', blush='#9a4a3a',
         nose='wide', nose_size=1.1, eye_style='sleepy', brow_tilt=7, brow_size=1.3, mouth='gentle', hair_style='topknot',
         beard_style='full', beard='#2a2420', belly=1.1, shoulders=1.2,
         shirt='#9dba8e', shirt_trim='#83a075', shorts='#6f6550', shorts_trim='#5b523f'),
    dict(BASE, id='dwarf6', label='Body 6', sex='f', skin='#b97a50', hair='#7a3020', eyes='#5a7a4a', blush='#d0705a',
         nose='potato', nose_size=.85, eye_style='squint', brow_tilt=-4, brow_size=.85, mouth='wide', hair_style='curly',
         beard_style='none', freckles=True, lashes=True, belly=1.2, hips=1.15,
         shirt='#d6b86e', shirt_trim='#bb9d57', shorts='#5f7b78', shorts_trim='#4d6663'),
]

# Bone positions (head, tail) for the dwarf skeleton. Left side (+X); the right side mirrors it.
BONES = {
    'root': ((0, 0, 0), (0, 0, .34)),
    'hips': ((0, 0, .34), (0, 0, .42)),
    'spine': ((0, 0, .42), (0, 0, .62)),
    'chest': ((0, 0, .62), (0, 0, .76)),
    'head': ((0, 0, .78), (0, 0, 1.08)),
    'upperarm': ((.27, 0, .68), (.43, .01, .68)),
    'lowerarm': ((.43, .01, .68), (.58, 0, .68)),
    'wrist': ((.58, 0, .68), (.64, 0, .68)),
    'hand': ((.64, 0, .68), (.73, 0, .68)),
    'handslot': ((.72, 0, .63), (.72, -.07, .63)),
    'upperleg': ((.15, 0, .36), (.15, -.005, .21)),
    'lowerleg': ((.15, -.005, .21), (.15, .012, .085)),
    'foot': ((.15, .012, .085), (.15, -.05, .03)),
    'toes': ((.15, -.05, .03), (.15, -.15, .03)),
}
SIDED = ('upperarm', 'lowerarm', 'wrist', 'hand', 'handslot', 'upperleg', 'lowerleg', 'foot', 'toes')

# ---------------------------------------------------------------- shape helpers


def el(co, half, stiff=2.0, neg=False, rot=(0, 0, 0)):
    """One soft ellipsoid: centre and half-sizes in metres (as it would look on its own)."""
    return dict(co=co, half=half, stiff=stiff, neg=neg, rot=rot)


def scene_link(ob):
    bpy.context.scene.collection.objects.link(ob)


def meta_mesh(name, elements, res=.012, target_tris=600, cuts=()):
    """Melt the soft shapes into one surface, then cut it down to about target_tris flat triangles.
    cuts: (point, normal) planes sliced through the result, so colour edges (a shirt hem, a sleeve)
    follow a clean line instead of zig-zagging along the triangles."""
    mb = bpy.data.metaballs.new('mb' + name)
    mb.resolution = mb.render_resolution = res
    mb.threshold = .6
    for e in elements:
        h = max(e['half'])
        m = mb.elements.new(type='ELLIPSOID')
        m.co = e['co']
        m.radius = h / META_SURFACE
        m.size_x, m.size_y, m.size_z = (e['half'][0] / h, e['half'][1] / h, e['half'][2] / h)
        m.stiffness = e['stiff']
        m.use_negative = e['neg']
        m.rotation = Euler([math.radians(a) for a in e['rot']]).to_quaternion()
    ob = bpy.data.objects.new('mb' + name, mb)  # no dot in the name, so it melts only with itself
    scene_link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.metaballs.remove(mb)
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    tmp = bpy.data.objects.new(name + '_dec', me)
    scene_link(tmp)
    mod = tmp.modifiers.new('decimate', 'DECIMATE')
    mod.ratio = min(1.0, target_tris / max(tris, 1))
    mod.use_collapse_triangulate = True
    dg.update()
    out = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.meshes.remove(me)
    if cuts:
        bm = bmesh.new()
        bm.from_mesh(out)
        for co, no in cuts:
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
        bm.to_mesh(out)
        bm.free()
    out.name = name
    return out


def prim_mesh(name, kind, co, half, rot=(0, 0, 0), sub=1):
    """A crisp small piece (eye, tooth, brow): 'ball' (icosphere) or 'box'."""
    bm = bmesh.new()
    m = (Matrix.Translation(co) @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()
         @ Matrix.Diagonal((half[0], half[1], half[2], 1)))
    if kind == 'ball':
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0, matrix=m)
    else:
        bmesh.ops.create_cube(bm, size=2.0, matrix=m)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


class Painter:
    """Paints a mesh's faces: colour(centre, normal) -> (hex, is_skin). Adds the soft top-lit shade and a
    slight colour wobble per facet, and puts skin faces on the skin material."""

    def __init__(self, mats, seed):
        self.mats = mats
        self.rng = random.Random(seed)
        self.cache = {}

    def lin(self, h):
        if h not in self.cache:
            self.cache[h] = hexc(h)
        return self.cache[h]

    def paint(self, me, colour, vary=.04):
        attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        me.materials.clear()
        for m in self.mats:
            me.materials.append(m)
        for p in me.polygons:
            h, skin = colour(Vector(p.center), Vector(p.normal)) if callable(colour) else colour
            c = self.lin(h)
            k = (1 + self.rng.uniform(-vary, vary)) * (SHADE_DOWN + (SHADE_UP - SHADE_DOWN) * (p.normal.z * .5 + .5))
            for li in p.loop_indices:
                attr.data[li].color = (c[0] * k, c[1] * k, c[2] * k, 1.0)
            p.material_index = 1 if skin else 0
            p.use_smooth = False
        return me


def join_meshes(name, meshes, collection):
    """Join painted meshes into one object."""
    obs = []
    for me in meshes:
        ob = bpy.data.objects.new(me.name, me)
        collection.objects.link(ob)
        obs.append(ob)
    target = obs[0]
    if len(obs) > 1:
        with bpy.context.temp_override(active_object=target, object=target, selected_objects=obs,
                                       selected_editable_objects=obs):
            bpy.ops.object.join()
    target.name = name
    target.data.name = name
    return target


def inside(c, centre, half):
    return sum(((c[i] - centre[i]) / half[i]) ** 2 for i in range(3)) <= 1.0


def mirror(co):
    return (-co[0], co[1], co[2])


# ---------------------------------------------------------------- head, face, hair, beard


def head_shapes(B):
    n, ears, man = B['nose_size'], B['ears'], B['sex'] == 'm'
    E = [el((0, .01, .96), (.215, .2, .2)),                      # skull
         el((0, -.04, .855), (.2, .16, .12) if man else (.18, .15, .105)),   # jowls (softer for women)
         el((0, -.12, .79), (.09, .07, .06) if man else (.07, .06, .05))]    # chin
    for s in (-1, 1):
        E.append(el((s * .12, -.15, .872), (.062, .05, .052)))   # cheeks
        E.append(el((s * .215, 0, .925), (.032 * ears, .055 * ears, .078 * ears), rot=(0, s * -12, 0)))  # ears
        E.append(el((s * .235, .025, .985), (.018 * ears, .028 * ears, .04 * ears), rot=(0, s * -30, 0)))  # ear tips
        E.append(el((s * .088, -.205, .948), (.05, .04, .05), neg=True))  # eye sockets
    E.append(el((0, -.172, .995), (.15, .05, .036) if man else (.13, .04, .024)))  # brow ridge
    nose = B['nose']
    if nose == 'potato':
        E += [el((0, -.215, .885), (.075 * n, .068 * n, .065 * n), stiff=3),
              el((0, -.25, .878), (.052 * n, .045 * n, .045 * n), stiff=3)]
    elif nose == 'long':
        E += [el((0, -.22, .9), (.042 * n, .06 * n, .05 * n), stiff=3),
              el((0, -.275, .875), (.036 * n, .055 * n, .036 * n), stiff=3, rot=(20, 0, 0))]
    elif nose == 'button':
        E += [el((0, -.222, .888), (.048 * n, .042 * n, .042 * n), stiff=3)]
    elif nose == 'wide':
        E += [el((0, -.21, .882), (.085 * n, .055 * n, .05 * n), stiff=3)]
        for s in (-1, 1):
            E.append(el((s * .05 * n, -.228, .868), (.036 * n, .036 * n, .034 * n), stiff=3))
    return E


def face_colour(B):
    skin, blush = B['skin'], B['blush']
    rng = random.Random(B['id'])
    freckle_spots = [(s * rng.uniform(.09, .17), -.17, rng.uniform(.86, .9)) for s in (-1, 1) for _ in range(5)] \
        if B['freckles'] else []
    nose_c = (0, -.235, .88)

    def colour(c, n):
        for f in freckle_spots:
            if (c - Vector(f)).length < .014:
                return (mix_hex(skin, '#6a3a20', .35), True)
        for s in (-1, 1):
            if (c - Vector((s * .135, -.16, .872))).length < .055:
                return (mix_hex(skin, blush, .38), True)
        if (c - Vector(nose_c)).length < .06:
            return (mix_hex(skin, blush, .18), True)
        return (skin, True)
    return colour


def mix_hex(a, b, t):
    x = [int(a.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    y = [int(b.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join('%02x' % round(x[i] + (y[i] - x[i]) * t) for i in range(3))


def eye_disc(name, eye, r, centre, radius, lift, segs=16):
    """A round, flat-shaded disc (iris, pupil, highlight) lying on the front of an eyeball.
    eye: the eyeball's centre; r: its radius (it is r * .8 deep); centre: the disc's (x, z);
    lift: how far it sits in front of the eyeball's surface, so the layers stack."""
    ex, ey, ez = eye

    def on_eye(px, pz):
        d = ((px - ex) ** 2 + (pz - ez) ** 2) / r ** 2
        return (px, ey - .8 * r * math.sqrt(max(0.0, 1 - d)) - lift, pz)

    bm = bmesh.new()
    mid = bm.verts.new(on_eye(*centre))
    rings = [[bm.verts.new(on_eye(centre[0] + radius * f * math.cos(a), centre[1] + radius * f * math.sin(a)))
              for a in (2 * math.pi * k / segs for k in range(segs))] for f in (.55, 1.0)]
    for k in range(segs):
        j = (k + 1) % segs
        bm.faces.new((mid, rings[0][k], rings[0][j]))
        bm.faces.new((rings[0][k], rings[1][k], rings[1][j]))
        bm.faces.new((rings[0][k], rings[1][j], rings[0][j]))
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y > 0:  # face out of the eye, towards the viewer
            f.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


# Closed smiles: half-width, how far the corners turn up, and how much one side lifts more (a smirk).
MOUTHS = {
    'wide': (.05, .012, 0),
    'gentle': (.04, .008, 0),
    'small': (.032, .008, 0),
    'smirk': (.04, .003, .012),
}


def mouth_pieces(B, P, face):
    """A closed smile: a thin curved line that turns up at the corners, laid on the face (the head
    mesh) just under the nose, wherever that nose ends."""
    w, lift, smirk = MOUTHS[B['mouth']]
    tree = BVHTree.FromPolygons([v.co.copy() for v in face.vertices], [p.vertices[:] for p in face.polygons])

    def surface_y(x, z):
        loc = tree.ray_cast(Vector((x, -1, z)), Vector((0, 1, 0)))[0]
        return loc.y if loc else -.21
    cheek_y = surface_y(0, .79)
    z0 = .79
    while z0 < .84 and surface_y(0, z0 + .002) > cheek_y - .025:  # climb until the nose starts
        z0 += .002
    z0 = max(.8, z0 - .018)
    n = 8

    def point(t):
        x = t * w
        z = z0 + lift * t * t + smirk * max(0.0, t) ** 2
        return (x, surface_y(x, z) - .001, z)
    pts = [point(-1 + 2 * k / n) for k in range(n + 1)]
    out = []
    for a, b in zip(pts, pts[1:]):
        dx, dz = b[0] - a[0], b[2] - a[2]
        out.append(P.paint(prim_mesh('mouth', 'box', tuple((a[i] + b[i]) / 2 for i in range(3)),
                                     (math.hypot(dx, dz) / 2 + .0015, .0035, .0042),
                                     rot=(0, -math.degrees(math.atan2(dz, dx)), 0)), (B['lips'], False)))
    return out


def eye_pieces(B, P):
    """Eyeballs, round irises, pupils, highlights, lids, lashes and brows: small crisp pieces."""
    out = []
    style, es = B['eye_style'], B['eye_size']
    for s in (-1, 1):
        x = s * .088
        size = es * (1.22 if style == 'goofy' and s > 0 else .92 if style == 'goofy' else 1.1 if style == 'wide' else 1.0)
        r = .045 * size
        cy = -.172
        front = cy - r
        eye = (x, cy, .948)
        look = (x + s * .002, .945)
        out.append(P.paint(prim_mesh('eye', 'ball', eye, (r, r * .8, r), sub=2), ('#fbfaf5', False)))
        out.append(P.paint(eye_disc('iris', eye, r, look, .027 * size, .0012), (B['eyes'], False)))
        out.append(P.paint(eye_disc('pupil', eye, r, look, .0135 * size, .0024), ('#1e1612', False)))
        out.append(P.paint(eye_disc('glint', eye, r, (look[0] - .008 * size, look[1] + .009 * size), .0055 * size,
                                    .0036, segs=10), ('#ffffff', False)))
        if style in ('sleepy', 'squint'):
            out.append(P.paint(prim_mesh('lid', 'ball', (x, cy - .012, .962 + (.004 if style == 'sleepy' else 0)),
                                         (r * 1.12, r * .85, r * .62)), (B['skin'], True)))
        if style == 'squint':
            out.append(P.paint(prim_mesh('lid', 'ball', (x, cy - .012, .922), (r * 1.1, r * .8, r * .5)), (B['skin'], True)))
        if B['lashes']:
            for k in (0, 1):
                out.append(P.paint(prim_mesh('lash', 'box', (x + s * (.036 + k * .01) * size, front + .006, .968 - k * .008),
                                             (.012, .004, .004), rot=(0, s * (35 + k * 20), 0)), ('#1e1612', False)))
        bs = B['brow_size']
        out.append(P.paint(prim_mesh('brow', 'ball', (x + s * .004, -.208, 1.006 + (.006 if style == 'wide' else 0)),
                                     (.058 * bs, .02, .017 * bs), rot=(0, s * B['brow_tilt'], 0)), (B['hair'], False)))
    return out


FACE_CUT = el((0, -.2, .9), (.215, .14, .155), neg=True)


def chest_front(B, z):
    """How far forward (negative y) the shirt reaches at height z, so hanging braids lie on it, not in it."""
    b = B['belly']
    belly = .03 + .26 * b * math.sqrt(max(0.0, 1 - ((z - .5) / .19) ** 2))
    chest = .21 * math.sqrt(max(0.0, 1 - ((z - .635) / .13) ** 2))
    return -max(belly, chest, .1)


def BRAID_PATH(B):
    """Two hair braids from behind the ears, forward over the shoulders and down onto the chest."""
    pts = [(.2, -.08, .87), (.185, -.13, .8)]
    for k, z in enumerate((.73, .66, .59)):
        pts.append((.17 - k * .01, chest_front(B, z) - .045, z))
    return pts


def hair_shapes(B):
    style = B['hair_style']
    rng = random.Random(B['id'] + 'hair')
    cap = [el((0, .02, .975), (.228, .218, .212)), el((0, .1, .87), (.19, .13, .12)),  # down to the nape
           FACE_CUT, el((0, -.14, .86), (.25, .12, .07), neg=True)]  # keep the cheeks clear
    if style == 'bald_tufts':
        E = [el((0, .15, .9), (.16, .08, .09))]
        for s in (-1, 1):
            E.append(el((s * .2, .06, .93), (.06, .11, .09)))
        E.append(el((.03, -.04, 1.16), (.06, .05, .03), rot=(0, 0, 20)))
        return E
    if style == 'messy':
        E = list(cap)
        for _ in range(9):
            E.append(el((rng.uniform(-.15, .15), rng.uniform(-.1, .12), rng.uniform(1.1, 1.17)),
                        (.07, .05, .04), rot=(rng.uniform(-30, 30), rng.uniform(-30, 30), rng.uniform(0, 180))))
        E.append(el((.05, -.15, 1.06), (.08, .04, .04), rot=(0, 20, 0)))  # a fringe that flops forward
        return E
    if style == 'topknot':
        E = [el((0, .02, 1.12), (.07, .19, .07)), el((0, .08, 1.24), (.065, .065, .065))]
        for s in (-1, 1):
            E.append(el((s * .2, .05, .95), (.04, .1, .07)))
        return E
    if style == 'braids':
        E = list(cap)
        front = BRAID_PATH(B)
        for s in (-1, 1):
            for k, (x, y, z) in enumerate(front):
                r = .052 - k * .004
                E.append(el((s * x, y, z), (r, r, r * 1.1), stiff=3))
        return E
    if style == 'bun':
        E = list(cap) + [el((0, .06, 1.25), (.095, .09, .085), stiff=3), el((0, -.09, 1.1), (.13, .07, .05), rot=(-20, 0, 0))]
        return E
    if style == 'curly':
        E = [el((0, .02, .985), (.235, .225, .215)), el((0, .1, .87), (.2, .14, .13)),
             FACE_CUT, el((0, -.14, .86), (.25, .12, .07), neg=True)]
        for i in range(16):
            t = math.radians(-115 + i * (230 / 15))  # around the back and sides, never the face
            z = .88 + .24 * ((i * 7) % 5) / 4
            E.append(el((math.sin(t) * .22, math.cos(t) * .2 + .03, z), (.075, .075, .075)))
        for i in range(5):
            E.append(el((-.12 + i * .06, -.12, 1.12 + (i % 2) * .02), (.06, .06, .06)))
        return E
    return []


def hair_extras(B, P):
    """Ties and bands that are not hair: a little colour against the hair."""
    out = []
    tie = B['shirt_trim']
    if B['hair_style'] == 'braids':
        x, y, z = BRAID_PATH(B)[-1]
        for s in (-1, 1):
            out.append(P.paint(prim_mesh('tie', 'box', (s * x, y, z - .05), (.04, .04, .016)), ('#c0403a', False)))
    if B['hair_style'] == 'bun':
        out.append(P.paint(prim_mesh('tie', 'box', (0, .06, 1.175), (.07, .065, .016)), ('#3a70c0', False)))
    if B['hair_style'] == 'topknot':
        out.append(P.paint(prim_mesh('tie', 'box', (0, .06, 1.175), (.045, .045, .014)), (tie, False)))
    return out


BEARD_BRAID_Z = (.68, .62, .555, .49, .43)


def beard_braid_y(B, z):
    return min(-.24, chest_front(B, z) - .035)


def beard_shapes(B):
    style = B['beard_style']
    if style == 'none':
        return []
    stache = [el((s * .07, -.238, .862), (.08, .032, .03), rot=(0, s * -16, 0)) for s in (-1, 1)]
    mouth_hole = el((0, -.25, .818), (.075, .09, .036), stiff=4, neg=True)
    if style == 'stache':
        return [el((s * .08, -.235, .855), (.095, .035, .034), rot=(0, s * -16, 0)) for s in (-1, 1)]
    mass = [el((0, -.12, .79), (.19, .12, .15)), el((0, -.17, .73), (.13, .08, .1))]
    sides = [el((s * .175, -.07, .85), (.055, .085, .1)) for s in (-1, 1)]
    if style == 'chops':
        return sides + stache
    E = mass + sides + stache + [mouth_hole]
    if style == 'braids':
        for s in (-1, 1):
            for k, z in enumerate(BEARD_BRAID_Z):  # from under the beard, down over the chest or belly
                r = .046 - k * .003
                E.append(el((s * .08, beard_braid_y(B, z), z), (r, r * .9, r * 1.1), stiff=3))
    if style == 'long':
        for k, z in enumerate((.66, .57, .48)):
            E.append(el((0, -.17 - k * .01, z), (.1 - k * .02, .07 - k * .01, .08)))
    return E


def beard_extras(B, P):
    out = []
    if B['beard_style'] == 'braids':
        for s in (-1, 1):
            for z in (BEARD_BRAID_Z[2] + .035, BEARD_BRAID_Z[3] + .035):
                out.append(P.paint(prim_mesh('ring', 'box', (s * .08, beard_braid_y(B, z), z), (.037, .035, .011)),
                                   ('#d9a62b', False)))
    return out


# ---------------------------------------------------------------- body, arms, legs


def body_shapes(B):
    b, sh, hp = B['belly'], B['shoulders'], B['hips']
    E = [el((0, -.03, .5), (.29 * b, .26 * b, .19)),
         el((0, 0, .635), (.26 * sh, .21, .13)),
         el((0, 0, .39), (.25 * hp, .22, .1)),
         el((0, -.01, .785), (.085, .08, .06))]
    for s in (-1, 1):
        E.append(el((s * .22 * sh, 0, .685), (.1, .1, .08)))
        if B['sex'] == 'f':
            E.append(el((s * .085, -.14 - (b - 1) * .1, .625), (.07, .05, .05)))
    return E


BODY_CUTS = (.425, .452, .722, .742)  # waistband, collar
LEG_CUTS = [((0, 0, z), (0, 0, 1)) for z in (.225, .245)]  # shorts hem


def arm_cuts(s):
    return [((s * x, 0, 0), (1, 0, 0)) for x in (.36, .38)]  # sleeve hem


def body_colour(B):
    def colour(c, n):
        if c.z > .742 and abs(c.x) < .13:
            return (B['skin'], True)
        if c.z > .722 and abs(c.x) < .16:
            return (B['shirt_trim'], False)
        if c.z > .452:
            return (B['shirt'], False)
        if c.z > .425:
            return (B['shorts_trim'], False)
        return (B['shorts'], False)
    return colour


def arm_shapes(B, s):
    sh = B['shoulders']
    E = [el((s * .25, 0, .68), (.095 * sh, .092, .092)),
         el((s * .35, 0, .68), (.08 * sh, .075, .075)),
         el((s * .45, 0, .68), (.066, .066, .066)),
         el((s * .53, 0, .679), (.07, .066, .066)),
         el((s * .6, 0, .675), (.055, .054, .054)),
         el((s * .67, 0, .67), (.07, .066, .046))]                 # big palm (facing down in the T-pose)
    for k, y in enumerate((-.042, -.014, .014, .042)):
        E.append(el((s * (.75 - abs(k - 1.5) * .008), y, .666), (.036, .017, .024), stiff=3))  # chunky fingers
    E.append(el((s * .66, -.07, .67), (.026, .04, .026), stiff=3, rot=(0, 0, s * -20)))  # thumb
    return E


def arm_colour(B, s):
    def colour(c, n):
        x = c.x * s
        if x < .36:
            return (B['shirt'], False)
        if x < .38:
            return (B['shirt_trim'], False)
        return (B['skin'], True)
    return colour


def leg_shapes(B, s):
    x = s * .15
    E = [el((x, 0, .34), (.12, .11, .1)),
         el((x, 0, .25), (.1, .095, .08)),
         el((x, 0, .17), (.078, .078, .07)),
         el((x, .005, .095), (.06, .06, .05)),
         el((x, -.05, .045), (.082, .125, .044)),               # foot
         el((x, .03, .045), (.062, .06, .042))]                  # heel
    for k, dx in enumerate((-.042, -.014, .014, .042)):
        E.append(el((x + s * dx, -.168 + abs(dx) * .4, .04), (.024 if k else .028, .024, .022), stiff=3))  # toes
    return E


def leg_colour(B, s):
    def colour(c, n):
        if c.z > .245:
            return (B['shorts'], False)
        if c.z > .225:
            return (B['shorts_trim'], False)
        return (B['skin'], True)
    return colour


# ---------------------------------------------------------------- materials and rig


def material(name, skin):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    # different roughness keeps the glTF import step from merging skin and clothes into one material
    bsdf.inputs['Roughness'].default_value = .8 if skin else .86
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    if skin:
        mat['skin'] = True
    return mat


def bone_name(base, side):
    return base + ('.l' if side > 0 else '.r') if base in SIDED else base


def fit_armature(arm):
    """Move the copied skeleton's bones to dwarf proportions. Names, parents and rolls stay."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    for base, (h, t) in BONES.items():
        for side in ((1, -1) if base in SIDED else (1,)):
            b = eb[bone_name(base, side)]
            b.use_connect = False
            b.head = Vector(h if side > 0 else mirror(h))
            b.tail = Vector(t if side > 0 else mirror(t))
    bpy.ops.object.mode_set(mode='OBJECT')


def base_rig():
    """The game's own skeleton, taken from an existing character so names and rolls match, fitted once
    to dwarf proportions. Kept hidden; every body gets a copy."""
    rig = bpy.data.objects.get('DwarfRigBase')
    if rig:
        return rig
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(REPO, 'assets', 'characters', 'knight.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    rig = [o for o in new if o.type == 'ARMATURE'][0]
    for o in new:
        if o is not rig:
            bpy.data.objects.remove(o, do_unlink=True)
    rig.animation_data_clear()
    rig.name = 'DwarfRigBase'
    fit_armature(rig)
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    rig.hide_set(True)
    rig.hide_render = True
    return rig


def dist_to_segment(p, a, b):
    ab = b - a
    t = 0 if ab.length_squared == 0 else max(0, min(1, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def skin_to(ob, arm, names, top=3, power=3.0):
    segs = {b.name: (Vector(b.head_local), Vector(b.tail_local)) for b in arm.data.bones}
    for n in names:
        ob.vertex_groups.new(name=n)
    for v in ob.data.vertices:
        d = sorted(((dist_to_segment(v.co, *segs[n]), n) for n in names))[:top]
        w = [1 / (dd + .02) ** power for dd, _ in d]
        s = sum(w)
        for (dd, n), ww in zip(d, w):
            ob.vertex_groups[n].add([v.index], ww / s, 'REPLACE')
    ob.parent = arm
    ob.modifiers.new('Armature', 'ARMATURE').object = arm


def relax_arms(arm, degrees=62):
    """Let the arms hang down (the rig's rest pose is a T), for pictures."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    for side, sign in (('l', 1), ('r', -1)):
        pb = arm.pose.bones['upperarm.' + side]
        h = pb.head.copy()
        pb.matrix = (Matrix.Translation(h) @ Matrix.Rotation(math.radians(degrees) * sign, 4, 'Y')
                     @ Matrix.Translation(-h)) @ pb.matrix
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()


def clear_dwarves():
    for o in list(bpy.data.objects):
        if o.type == 'MESH' or (o.type == 'ARMATURE' and o.name != 'DwarfRigBase'):
            bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        if c.name.startswith('Dwarf_'):
            bpy.data.collections.remove(c)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)


# ---------------------------------------------------------------- building


def build_body(B, x=0.0, relax=0, clear=True, beard=True, all_beards=False):
    """One dwarf on its own copy of the skeleton. all_beards: build every beard style as its own
    Beard_<style> piece (for the game, which shows the one the player picked) instead of just this
    body's own beard."""
    if clear:
        clear_dwarves()
    bid = B['id']
    base = base_rig()
    arm = base.copy()
    arm.data = base.data.copy()
    arm.name = 'Rig_' + bid
    arm.hide_set(False)
    arm.location = (x, 0, 0)
    col = bpy.data.collections.new('Dwarf_' + bid)
    bpy.context.scene.collection.children.link(col)
    col.objects.link(arm)
    mats = [material(bid + '_body', False), material(bid + '_skin', True)]
    P = Painter(mats, bid)
    hair_c = (B['hair'], False)

    face = P.paint(meta_mesh('head', head_shapes(B), .011, 900), face_colour(B))
    head = [face] + eye_pieces(B, P) + mouth_pieces(B, P, face)
    hs = hair_shapes(B)
    if hs:
        head.append(P.paint(meta_mesh('hair', hs, .012, 520), hair_c))
    head += hair_extras(B, P)
    parts = {
        'Head': (head, ['head']),
        'Body': ([P.paint(meta_mesh('body', body_shapes(B), .016, 560, cuts=[((0, 0, z), (0, 0, 1)) for z in BODY_CUTS]),
                          body_colour(B))], ['hips', 'spine', 'chest']),
        'ArmLeft': ([P.paint(meta_mesh('arml', arm_shapes(B, 1), .0085, 340, cuts=arm_cuts(1)), arm_colour(B, 1))],
                    ['upperarm.l', 'lowerarm.l', 'wrist.l', 'hand.l']),
        'ArmRight': ([P.paint(meta_mesh('armr', arm_shapes(B, -1), .0085, 340, cuts=arm_cuts(-1)), arm_colour(B, -1))],
                     ['upperarm.r', 'lowerarm.r', 'wrist.r', 'hand.r']),
        'LegLeft': ([P.paint(meta_mesh('legl', leg_shapes(B, 1), .01, 320, cuts=LEG_CUTS), leg_colour(B, 1))],
                    ['upperleg.l', 'lowerleg.l', 'foot.l', 'toes.l']),
        'LegRight': ([P.paint(meta_mesh('legr', leg_shapes(B, -1), .01, 320, cuts=LEG_CUTS), leg_colour(B, -1))],
                     ['upperleg.r', 'lowerleg.r', 'foot.r', 'toes.r']),
    }
    bc = (B['beard'] or B['hair'], False)
    for style in (BEARD_STYLES if all_beards else (B['beard_style'],) if beard else ()):
        BB = dict(B, beard_style=style)
        bs = beard_shapes(BB)
        if bs:
            parts['Beard_' + style if all_beards else 'Beard'] = (
                [P.paint(meta_mesh('beard', bs, .011, 520), bc)] + beard_extras(BB, P), ['head'])
    objs = {}
    for name, (meshes, bones) in parts.items():
        ob = join_meshes('%s_%s' % (bid, name), meshes, col)
        skin_to(ob, arm, bones)
        objs[name] = ob
    if relax:
        relax_arms(arm, relax)
    tris = {n: sum(len(p.vertices) - 2 for p in o.data.polygons) for n, o in objs.items()}
    return {'id': bid, 'tris': tris, 'total': sum(tris.values())}


# The game's id for each body, Body 1 to Body 6 (decision 0112: the ids never change, so a character
# made with an old body simply becomes the dwarf with the same number).
GAME_IDS = ('knight', 'barbarian', 'mage', 'ranger', 'rogue', 'rogueHooded')
BEARD_STYLES = ('braids', 'long', 'full', 'stache', 'chops')
SKELETON = 'Rig_Medium'


def export_body(B, game_id, tmp_dir):
    """Builds one dwarf with every beard style and writes assets/characters/<game_id>.glb. The skeleton
    is exported under the game's name for it (Rig_Medium) and marked dwarf, so the game plays the
    dwarf's own moves on it."""
    report = build_body(B, all_beards=True)
    rig = bpy.data.objects['Rig_' + B['id']]
    rig['dwarf'] = True
    rig.name = SKELETON
    meshes = [o for o in rig.children if o.type == 'MESH']
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in [rig, *meshes]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    raw = os.path.join(tmp_dir, game_id + '.glb')
    try:
        bpy.ops.export_scene.gltf(
            filepath=raw, export_format='GLB', use_selection=True, export_yup=True,
            export_apply=False, export_skins=True, export_animations=False,
            export_vertex_color='MATERIAL', export_all_vertex_colors=False, export_def_bones=False,
            export_materials='EXPORT', export_extras=True)
    finally:
        rig.name = 'Rig_' + B['id']
    out = os.path.join(REPO, 'assets', 'characters', game_id + '.glb')
    subprocess.run(['node', os.path.join(REPO, 'tools', 'import-model.mjs'), raw, out],
                   cwd=REPO, check=True, shell=os.name == 'nt')
    return report


def export_all(tmp_dir):
    """All six into the game, then the six side by side (T-pose, every beard) saved as the source file
    assets/characters/dwarf-bodies.blend (a copy: the file open in Blender stays as it is)."""
    os.makedirs(tmp_dir, exist_ok=True)
    report = [export_body(B, gid, tmp_dir) for B, gid in zip(BODIES, GAME_IDS)]
    clear_dwarves()
    for i, B in enumerate(BODIES):
        build_body(B, x=(i - 2.5) * 1.0, clear=False, all_beards=True)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(REPO, 'assets', 'characters', 'dwarf-bodies.blend'),
                                copy=True, compress=True)
    return report


def build_lineup(bodies, spacing=1.0, relax=62, beard=True):
    clear_dwarves()
    bodies = list(bodies)
    return [build_body(B, x=(i - (len(bodies) - 1) / 2) * spacing, relax=relax, clear=False, beard=beard)
            for i, B in enumerate(bodies)]


def render_views(out_dir, tag, views=('front', 'three', 'side', 'back'), size=(640, 800), target=(0, 0, .74), dist=4.6,
                 lens=85):
    """Render preview pictures (soft light, plain grey) to out_dir/<tag>_<view>.png for checking the model."""
    scene = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = next(e for e in engines if e.startswith('BLENDER_EEVEE'))
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    world = scene.world or bpy.data.worlds.new('PreviewWorld')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (.62, .64, .66, 1)
    bg.inputs['Strength'].default_value = .9
    cam = bpy.data.objects.get('PreviewCam')
    if cam is None:
        cam = bpy.data.objects.new('PreviewCam', bpy.data.cameras.new('PreviewCam'))
        scene_link(cam)
    cam.data.lens = lens
    scene.camera = cam
    sun = bpy.data.objects.get('PreviewSun')
    if sun is None:
        sun = bpy.data.objects.new('PreviewSun', bpy.data.lights.new('PreviewSun', 'SUN'))
        scene_link(sun)
    sun.data.energy = 3.0
    sun.rotation_euler = Euler((math.radians(50), 0, math.radians(-30)))
    dirs = {'front': (0, -1, .05), 'three': (.6, -.8, .15), 'side': (1, 0, .05), 'back': (0, 1, .1)}
    paths = []
    for v in views:
        loc = Vector(target) + Vector(dirs[v]).normalized() * dist
        cam.location = loc
        cam.rotation_euler = (Vector(target) - loc).to_track_quat('-Z', 'Y').to_euler()
        path = os.path.join(out_dir, '%s_%s.png' % (tag, v))
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        paths.append(path)
    return paths
