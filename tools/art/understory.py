# The forest-floor plants, built in Blender through the Blender MCP. Exec this file, then call
# build_all(). Pieces: sword ferns (two sizes), a salal bush and a mossy mound.
# Same recipe as iron_axe.py: chunky low-poly shapes coloured with vertex colours (dark and cool
# near the ground, brighter toward the tips, tops lit and undersides shaded) so there is no texture
# to blur at a distance. Origin at the base, 1 unit = 1 m, Z up in Blender (Y up after glTF export).
import math
import random
import bpy
import bmesh
import os
import sys
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import SHADE_DOWN, SHADE_UP, hexc, lerp, make_material, Piece, tri_count  # noqa: E402


# --- sword fern -------------------------------------------------------------------------------

FERN_BASE, FERN_MID, FERN_TIP = hexc('#2f6a2a'), hexc('#58a03a'), hexc('#a8d055')


def fern_colour(t):
    return lerp(FERN_BASE, FERN_MID, t * 1.6) if t < 0.62 else lerp(FERN_MID, FERN_TIP, (t - 0.62) / 0.38)


def build_fern(name, seed, collection, mat, fronds=13, size=1.0):
    random.seed(seed)
    p = Piece(name)
    for i in range(fronds):
        ang = i / fronds * math.tau + random.uniform(-0.18, 0.18)
        inner = i % 3 == 0
        L = random.uniform(0.9, 1.15) * (0.68 if inner else 1.0) * size
        h0 = random.uniform(1.0, 1.3) if inner else random.uniform(0.6, 0.95)
        curve = random.uniform(0.9, 1.25) if inner else random.uniform(1.4, 1.95)
        M = Matrix.Rotation(ang, 4, 'Z') @ Matrix.Translation((0.02 * size, 0, 0.03))
        seg = 11
        spine = [Vector((0, 0, 0))]
        for s in range(seg):
            head = h0 - curve * (s / seg)
            spine.append(spine[-1] + Vector((math.cos(head), 0, math.sin(head))) * (L / seg))
        for s in range(seg):
            a, b = spine[s], spine[s + 1]
            t0, t1 = s / seg, (s + 1) / seg
            wa, wb = 0.018 * (1 - t0 * 0.75), 0.018 * (1 - t1 * 0.75)
            c0, c1 = lerp(FERN_BASE, (0.33, 0.30, 0.12), 0.45), lerp(FERN_BASE, FERN_MID, t1)
            p.face([p.vert(M @ (a + Vector((0, -wa, 0))), c0), p.vert(M @ (a + Vector((0, wa, 0))), c0),
                    p.vert(M @ (b + Vector((0, wb, 0))), c1), p.vert(M @ (b + Vector((0, -wb, 0))), c1)])
        for s in range(2, seg + 1):
            t = s / seg
            a, b = spine[s - 1], spine[s]
            d = (b - a).normalized()
            base = (a + b) / 2
            # leaflets stay long most of the way, then taper to the tip like a real sword fern
            ll = L * 0.25 * min(1.0, t * 2.4) * (1 - 0.8 * max(0.0, t - 0.5) / 0.5) + 0.02
            for side in (-1, 1):
                out = Vector((0, side, 0))
                lean = (out * 0.88 + d * 0.5).normalized()
                w = ll * 0.17
                tip = base + lean * ll + Vector((0, 0, -ll * 0.16))
                mid = base + lean * ll * 0.5 + Vector((0, 0, ll * 0.07))
                col_b, col_t = fern_colour(t), fern_colour(min(1, t + 0.1))
                v1 = p.vert(M @ (base - d * w), col_b)
                v2 = p.vert(M @ (base + d * w), col_b)
                m1 = p.vert(M @ (mid + d * w * 1.15), col_t)
                m2 = p.vert(M @ (mid - d * w * 1.15), col_t)
                vt = p.vert(M @ tip, fern_colour(min(1, t + 0.18)))
                p.face([v1, v2, m1, m2])
                p.face([m2, m1, vt])
    return p.finish(collection, mat)


# --- salal ------------------------------------------------------------------------------------

LEAF_DARK, LEAF_LIGHT, LEAF_NEW = hexc('#245a35'), hexc('#3f8a3c'), hexc('#8fc65a')
STEM, BERRY = hexc('#6a4528'), hexc('#4a2a66')


def leaf(p, centre, yaw, pitch, length, colour_a, colour_b):
    """One leathery oval leaf: a tapered diamond with a slight fold along the midrib."""
    fwd = Vector((math.cos(yaw) * math.cos(pitch), math.sin(yaw) * math.cos(pitch), math.sin(pitch)))
    side = Vector((-math.sin(yaw), math.cos(yaw), 0))
    w = length * 0.34
    base = p.vert(centre, colour_a)
    ml = p.vert(centre + fwd * length * 0.45 - side * w + Vector((0, 0, -length * 0.03)), lerp(colour_a, colour_b, 0.5))
    mr = p.vert(centre + fwd * length * 0.45 + side * w + Vector((0, 0, -length * 0.03)), lerp(colour_a, colour_b, 0.5))
    mid = p.vert(centre + fwd * length * 0.5 + Vector((0, 0, length * 0.05)), lerp(colour_a, colour_b, 0.6))
    tip = p.vert(centre + fwd * length + Vector((0, 0, -length * 0.07)), colour_b)
    p.face([base, mr, mid]); p.face([base, mid, ml])
    p.face([mid, mr, tip]); p.face([mid, tip, ml])


def build_salal(name, seed, collection, mat, size=1.0):
    random.seed(seed)
    p = Piece(name)
    stems = 15
    for i in range(stems):
        ang = i / stems * math.tau + random.uniform(-0.25, 0.25)
        reach = random.uniform(0.25, 0.6) * size
        height = random.uniform(0.35, 0.75) * size
        pts = []
        for s in range(5):
            t = s / 4
            r = reach * t
            z = height * math.sin(t * math.pi * 0.55) + 0.02
            pts.append(Vector((math.cos(ang) * r, math.sin(ang) * r, z)))
        for s in range(4):
            a, b = pts[s], pts[s + 1]
            perp = Vector((-math.sin(ang), math.cos(ang), 0)) * 0.016
            c = lerp(STEM, hexc('#6b4a2a'), s / 4)
            p.face([p.vert(a - perp, STEM), p.vert(a + perp, STEM), p.vert(b + perp, c), p.vert(b - perp, c)])
        # leaves sit in pairs along the upper half of each stem, tipped outward and up
        for s in range(1, 5):
            t = s / 4
            for side in (-1, 1):
                if random.random() < 0.12:
                    continue
                yaw = ang + side * random.uniform(0.7, 1.25)
                pitch = random.uniform(0.0, 0.45)
                length = random.uniform(0.26, 0.36) * size * (1.0 - 0.15 * t)
                newish = t > 0.7 and random.random() < 0.5
                leaf(p, pts[s], yaw, pitch, length, LEAF_DARK if not newish else LEAF_LIGHT,
                     LEAF_LIGHT if not newish else LEAF_NEW)
        leaf(p, pts[4], ang, 0.15, 0.3 * size, LEAF_LIGHT, LEAF_NEW)
        if random.random() < 0.7:
            # a little cluster of dark purple berries hanging at the end
            for k in range(3):
                o = Vector((random.uniform(-.04, .04), random.uniform(-.04, .04), -0.04 - 0.03 * k))
                c = pts[3] + o
                bp = [c + Vector((0, 0, 0.02)), c + Vector((0.02, 0, 0)), c + Vector((0, 0.02, 0)),
                      c + Vector((-0.02, 0, 0)), c + Vector((0, -0.02, 0)), c + Vector((0, 0, -0.02))]
                vs = [p.vert(q, BERRY if i2 else lerp(BERRY, (0.5, 0.4, 0.7), 0.4)) for i2, q in enumerate(bp)]
                for a2, b2 in ((1, 2), (2, 3), (3, 4), (4, 1)):
                    p.face([vs[0], vs[a2], vs[b2]]); p.face([vs[5], vs[b2], vs[a2]])
    return p.finish(collection, mat)


# --- moss mound -------------------------------------------------------------------------------

MOSS_DEEP, MOSS_MID, MOSS_BRIGHT = hexc('#2f6a22'), hexc('#58a02a'), hexc('#9bc84a')


def build_moss(name, seed, collection, mat, radius=0.35):
    """A clumpy green cushion: overlapping soft lumps, flat underneath, bright where the sun hits."""
    random.seed(seed)
    bm = bmesh.new()
    lumps = [(0.0, 0.0, 1.0)]
    for i in range(6):
        a = i / 6 * math.tau + random.uniform(-0.3, 0.3)
        r = random.uniform(0.3, 0.5)
        lumps.append((math.cos(a) * r, math.sin(a) * r, random.uniform(0.65, 0.85)))
    for (lx, ly, ls) in lumps:
        geo = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)["verts"]
        for v in geo:
            n = v.co.normalized()
            bump = 1.0 + random.uniform(-0.1, 0.1)
            v.co = Vector((lx * radius + n.x * radius * 0.75 * ls * bump,
                           ly * radius + n.y * radius * 0.75 * ls * bump,
                           max(n.z, -0.1) * radius * 0.5 * ls * bump))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    layer = me.color_attributes.new("Col", 'BYTE_COLOR', 'CORNER')
    top = radius * 0.5
    for poly in me.polygons:
        for li in poly.loop_indices:
            z = me.vertices[me.loops[li].vertex_index].co.z / top
            t = max(0.0, min(1.0, z))
            c = lerp(MOSS_DEEP, MOSS_MID, t * 1.5) if t < 0.65 else lerp(MOSS_MID, MOSS_BRIGHT, (t - 0.65) / 0.35)
            lit = SHADE_DOWN + (SHADE_UP - SHADE_DOWN) * (poly.normal.z * 0.5 + 0.5)
            layer.data[li].color = (c[0] * lit, c[1] * lit, c[2] * lit, 1.0)
    ob.data.materials.append(mat)
    for p2 in me.polygons:
        p2.use_smooth = True  # a soft cushion, unlike the faceted leaves
    return ob


# --- all together -----------------------------------------------------------------------------

def build_all():
    for o in list(bpy.data.objects):
        if o.name.startswith(('sword_fern', 'salal', 'moss_')):
            bpy.data.objects.remove(o, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)
    col = bpy.data.collections.get("understory") or bpy.data.collections.new("understory")
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    mat = make_material("understory")
    made = [
        build_fern("sword_fern_a", 11, col, mat, fronds=13, size=1.0),
        build_fern("sword_fern_b", 5, col, mat, fronds=9, size=0.7),
        build_salal("salal_a", 4, col, mat),
        build_moss("moss_mound_a", 2, col, mat),
    ]
    return {o.name: {"tris": tri_count(o), "dims": [round(x, 2) for x in o.dimensions]} for o in made}
