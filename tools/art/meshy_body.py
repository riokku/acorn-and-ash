# A player body made from a Meshy model (Meshy free plan, CC BY 4.0: credit Meshy; decision 0272).
# Meshy gives only the shape, so this script makes it game-ready in Blender, keeping the soft,
# rounded look: it stands the model on its feet at dwarf height, brings it under the triangle
# budget, shortens the nose, cuts clean hems and colours it, lays crisp eyes, brows and a smile on
# the face, adds our own five beards, fits the game's skeleton and exports it. Run inside Blender
# through the Blender MCP:
#
#     exec(open(r'<repo>/tools/art/meshy_body.py').read())
#     ob = prepare(raw_glb, 'body1', tris=7000, head_tris=2800)   # import, stand, scale, reduce
#     dress(ob, BODY1)                                   # nose, hems, colours and face
#     beards = build_beards(ob, BODY1)                   # body1_Beard_<style>, all five
#     rig = build_rig('Rig_body1')
#     attach(ob, rig, beards.values())                   # skin it to the skeleton
#     export_body(rig, 'knight', tmp_dir)                # assets/characters/knight.glb (Body 1)
#     dwarf_bodies.render_views(out_dir, 'tag', ...)     # preview pictures
#
# The cleaned-up result is saved in assets/characters/soft-body1.blend. After exporting, refit the
# moves with tools/retarget-dwarf-animations.mjs (see README).
#
# Colours go by body part, measured on the model in metres, because Meshy's own model has no
# colours: the shirt down to its hem with sleeves out to the elbow, the shorts, and bare skin
# everywhere else. The nose and cheeks blush softly. Skin is on a material of its own, marked
# 'skin', so the game can shade it for the player's skin tone (decision 0113); the eyes, brows and
# smile are on the other material so they keep their colour. Facing -Y, Z up, the left hand at +X,
# like the other bodies.
import importlib
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

REPO = r'C:\Users\studi\OneDrive\Desktop\Projects\acorn-and-ash'
sys.path.insert(0, os.path.join(REPO, 'tools', 'art'))
import common  # noqa: E402
import dwarf_bodies  # noqa: E402

importlib.reload(common)
importlib.reload(dwarf_bodies)

# Where each body's clothes end and its face sits, in metres on the prepared model. The collar
# slopes down from the back of the neck to the front, with a small V at the throat.
BODY1 = dict(
    id='body1',
    collar_front=(-.12, .93), collar_back=(.13, .985), collar_v=(.045, .45), shoulders=.19,
    hem=.42, shorts=.28, sleeve=.41,
    eyes=(.06, 1.149), eye_size=(.011, .014),
    brow=((.029, 1.18), (.067, 1.192), (.106, 1.188)), brow_thick=.026,
    nose=((0, 1.1), .075), nose_base=-.125, nose_keep=.67, cheeks=((.1, 1.07), .05),
    smile=(1.047, .042, .011, .011),  # height, half-width, how far the corners turn up, how wide it opens
    skin='#ecb898', blush='#e0857a', shirt='#e2d3b6', shorts_colour='#6e4a34',
    brows='#5a3a2a', eyes_colour='#2a1d18', mouth='#7a2e28', beard='#5a3a2a',
)

BEARD_STYLES = dwarf_bodies.BEARD_STYLES
el = dwarf_bodies.el
GOLD = '#d9a62b'


def prepare(raw_path, name, height=1.3, tris=8000, head_tris=3600, chin=.27):
    """Import Meshy's model, stand it on the ground at the origin, scale it to `height` metres and
    reduce it to about `tris` triangles, smooth shaded. The head (above `chin`, as a fraction of
    the height from the top) keeps about `head_tris` of them for the face; a single even reduce
    leaves the face too coarse for eyes and a smile."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=raw_path)
    ob = [o for o in bpy.data.objects if o not in before and o.type == 'MESH'][0]
    ob.name = ob.data.name = name
    me = ob.data
    zs = [v.co.z for v in me.vertices]
    k = height / (max(zs) - min(zs))
    xs = [v.co.x for v in me.vertices]
    centre = Vector(((max(xs) + min(xs)) / 2, 0, min(zs)))
    for v in me.vertices:
        v.co = (v.co - centre) * k
    me.update()

    def in_head(p):
        return p.center.z > height * (1 - chin)

    # First reduce everything evenly until the head is down to its share...
    dec = ob.modifiers.new('Reduce', 'DECIMATE')
    dec.ratio = min(1.0, head_tris / sum(1 for p in me.polygons if in_head(p)))
    dec.use_symmetry = True
    dec.symmetry_axis = 'X'
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=dec.name)
    # ...then reduce only the rest of the body down to the total.
    me = ob.data
    head = sum(1 for p in me.polygons if in_head(p))
    rest = len(me.polygons) - head
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bm = bmesh.from_edit_mesh(me)
    for f in bm.faces:
        f.select_set(False)
    for f in bm.faces:
        if f.calc_center_median().z <= height * (1 - chin):
            f.select_set(True)
    bmesh.update_edit_mesh(me)
    bpy.ops.mesh.decimate(ratio=(tris - head) / rest, use_symmetry=True, symmetry_axis='X')
    bpy.ops.object.mode_set(mode='OBJECT')
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def shorten_nose(ob, B):
    """Pull the nose back towards the face, keeping `nose_keep` of how far it sticks out, so it is a
    round button from the side too. The round tip slides back whole and only the root, where the
    nose meets the face, is squeezed; squashing the whole nose would flatten its tip. It eases off
    round the edge of the nose, leaving the cheeks."""
    (nx, nz), r = B['nose']
    base = B['nose_base']
    tip = min(v.co.y for v in ob.data.vertices if math.hypot(v.co.x - nx, v.co.z - nz) < r)
    shift = (base - tip) * (1 - B['nose_keep'])
    core = r * .6
    for v in ob.data.vertices:
        x, y, z = v.co
        d = math.hypot(x - nx, z - nz)
        if y < base and d < r:
            w = 1.0 if d < core else 1 - (d - core) / (r - core)
            w = w * w * (3 - 2 * w)
            s = y - base  # how far in front of the face, negative
            moved = min(s + shift, .3 * s)
            v.co.y = base + s + (moved - s) * w
    ob.data.update()


def collar_z(B, y):
    """How high the shirt comes up the neck at depth y."""
    (y0, z0), (y1, z1) = B['collar_front'], B['collar_back']
    return z0 + (y - y0) * (z1 - z0) / (y1 - y0)


def cut_hems(ob, B):
    """Cut the mesh along every place one colour meets another, so the hems, sleeve ends and collar
    are straight lines rather than the zigzag of whole triangles."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    (y0, z0), (y1, z1) = B['collar_front'], B['collar_back']
    depth, slope = B['collar_v']
    vz = z0 - depth  # the bottom of the V
    def everywhere(c):
        return True

    def round_neck(c):
        return .85 < c.z < 1.05 and abs(c.x) < .3

    def throat(c):
        return c.y < -.03 and vz - .01 < c.z < z0 + .04 and abs(c.x) < .06

    # (a point on the plane, its normal, which faces it may cut: a plane cuts right through the
    # model, so the collar and the V only cut near the neck)
    planes = [
        ((0, 0, B['hem']), (0, 0, 1), everywhere),
        ((0, 0, B['shorts']), (0, 0, 1), everywhere),
        ((B['sleeve'], 0, 0), (1, 0, 0), everywhere),
        ((-B['sleeve'], 0, 0), (1, 0, 0), everywhere),
        ((0, y0, z0), (0, -(z1 - z0), y1 - y0), round_neck),
        ((0, 0, vz), (-1, 0, slope), throat),  # the V's two sides: |x| = (z - vz) * slope
        ((0, 0, vz), (1, 0, slope), throat),
    ]
    for co, no, near in planes:
        faces = [f for f in bm.faces if near(f.calc_center_median())]
        edges = list({e for f in faces for e in f.edges})
        verts = list({v for f in faces for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=verts + edges + faces, plane_co=Vector(co),
                               plane_no=Vector(no).normalized(), dist=1e-5)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    me.update()


def body_part(B, c, normal):
    """Which part of the outfit (or bare skin) the surface at point c is."""
    x, y, z = c
    # the tops of the shoulders rise beside the jowls; they face up where the jowls face down
    shoulder = z < 1.02 and abs(x) > .12 and normal.z > .3
    if z > collar_z(B, y) and not (z < 1.0 and abs(x) > B['shoulders']) and not shoulder:
        return 'skin'
    depth, slope = B['collar_v']
    vz = B['collar_front'][1] - depth
    if y < -.05 and z > vz and abs(x) < (z - vz) * slope:
        return 'skin'  # the V at the throat
    if z > B['hem']:
        return 'skin' if abs(x) > B['sleeve'] else 'shirt'
    if z > B['shorts']:
        return 'shorts'
    return 'skin'


def skin_colour(B, co):
    """Skin with a soft blush on the round of the nose and on the cheeks."""
    skin, blush = Vector(common.hexc(B['skin'])), Vector(common.hexc(B['blush']))
    x, y, z = co
    t = 0.0
    if y < -.05:
        (nx, nz), nr = B['nose']
        d = math.hypot(x - nx, z - nz)
        if d < nr and y < -.13:
            t = max(t, .85 * min(1.0, (-.13 - y) / .03))
        (cx, cz), cr = B['cheeks']
        d = math.hypot(abs(x) - cx, z - cz)
        if d < cr:
            t = max(t, .55 * (1 - d / cr) ** 1.5)
    return skin.lerp(blush, t)


def surface(tree, x, z, start_y=-.16):
    """Where a ray from just in front of the face, straight back, meets the skin, and its normal.
    It starts behind the tip of the nose so it finds the face rather than the nose."""
    hit = tree.ray_cast(Vector((x, start_y, z)), Vector((0, 1, 0)))
    if hit[0] is None:
        return Vector((x, -.1, z)), Vector((0, -1, 0))
    return hit[0], hit[1]


def decal(name, tree, rings, lift, rows_between=0):
    """A thin piece laid on the face: rings of (x, z) outlines, the first a single centre point
    (a disc) or two rows walked side by side (a strip), each point sitting `lift` above the skin.
    A strip gets `rows_between` more rows across it, so it bends with the face instead of
    cutting under it."""
    bm = bmesh.new()
    if len(rings[0]) > 1 and rows_between:
        a, b = rings
        rings = [[(p[0] + (q[0] - p[0]) * r, p[1] + (q[1] - p[1]) * r) for p, q in zip(a, b)]
                 for r in (k / (rows_between + 1) for k in range(rows_between + 2))]

    def on_face(x, z):
        loc, n = surface(tree, x, z)
        return bm.verts.new(loc + n * lift)
    rows = [[on_face(x, z) for x, z in ring] for ring in rings]
    if len(rows[0]) == 1:  # a disc: centre fan, then quads between rings
        mid = rows[0][0]
        first = rows[1]
        for k in range(len(first)):
            bm.faces.new((mid, first[k], first[(k + 1) % len(first)]))
        for a, b in zip(rows[1:], rows[2:]):
            for k in range(len(a)):
                j = (k + 1) % len(a)
                bm.faces.new((a[k], b[k], b[j], a[j]))
    else:  # a strip, row by row
        for a, b in zip(rows, rows[1:]):
            for k in range(len(a) - 1):
                bm.faces.new((a[k], a[k + 1], b[k + 1], b[k]))
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y > 0:  # facing out of the face, towards the viewer
            f.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def ellipse(cx, cz, rx, rz, segs=14, f=1.0):
    return [(cx + rx * f * math.cos(2 * math.pi * k / segs), cz + rz * f * math.sin(2 * math.pi * k / segs))
            for k in range(segs)]


def face_pieces(ob, B):
    """Eyes with a glint, arched brows and an open smile: (mesh, colour) pieces for the face."""
    tree = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    out = []
    ex, ez = B['eyes']
    rx, rz = B['eye_size']
    for s in (-1, 1):
        x = s * ex
        out.append((decal('eye', tree, [[(x, ez)], ellipse(x, ez, rx, rz, f=.55), ellipse(x, ez, rx, rz)], .0015),
                    B['eyes_colour']))
        gx, gz = x - .0035, ez + .0045
        out.append((decal('glint', tree, [[(gx, gz)], ellipse(gx, gz, .0032, .0032, segs=8)], .0025), '#ffffff'))
        # brows: a strip along the brow ridge, thickest in the middle
        pts = [(s * px, pz) for px, pz in B['brow']]
        n = 14
        upper, lower = [], []
        for k in range(n + 1):
            t = k / n
            # a smooth curve through inner, middle and outer
            a, m, b = pts
            px = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * (2 * m[0] - (a[0] + b[0]) / 2) + t ** 2 * b[0]
            pz = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * (2 * m[1] - (a[1] + b[1]) / 2) + t ** 2 * b[1]
            h = B['brow_thick'] * (.55 + .45 * math.sin(math.pi * min(1.0, t * 1.15)))
            upper.append((px, pz + h * .55))
            lower.append((px, pz - h * .45))
        out.append((decal('brow', tree, [upper, lower], .0035, rows_between=2), B['brows']))
    z0, w, lift, opening = B['smile']
    n = 12
    top, bottom = [], []
    for k in range(n + 1):
        u = -1 + 2 * k / n
        zc = z0 + lift * u * u
        top.append((u * w, zc + .0015))
        bottom.append((u * w, zc + .0015 - opening * (1 - u * u) - .003))
    out.append((decal('smile', tree, [top, bottom], .002, rows_between=2), B['mouth']))
    return out


def dress(ob, B):
    """Cut the hems, colour the body by part and add the face pieces, all in one mesh with two
    materials: [<id>_body, <id>_skin]."""
    shorten_nose(ob, B)
    cut_hems(ob, B)
    me = ob.data
    mats = [dwarf_bodies.material(B['id'] + '_body', False), dwarf_bodies.material(B['id'] + '_skin', True)]
    me.materials.clear()
    for m in mats:
        me.materials.append(m)
    attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    flat = {'shirt': common.hexc(B['shirt']), 'shorts': common.hexc(B['shorts_colour'])}
    counts = {}
    for p in me.polygons:
        part = body_part(B, p.center, p.normal)
        counts[part] = counts.get(part, 0) + 1
        for li in p.loop_indices:
            if part == 'skin':
                col = skin_colour(B, me.vertices[me.loops[li].vertex_index].co)
            else:
                col = flat[part]
            attr.data[li].color = (*col, 1.0)
        p.material_index = 1 if part == 'skin' else 0
    # the face pieces join the body on its clothes material, so skin tone leaves them alone
    pieces = []
    for mesh, hex_colour in face_pieces(ob, B):
        mesh.materials.append(mats[0])
        a = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        for d in a.data:
            d.color = (*common.hexc(hex_colour), 1.0)
        for poly in mesh.polygons:
            poly.use_smooth = False
        piece = bpy.data.objects.new(mesh.name, mesh)
        for col in ob.users_collection:
            col.objects.link(piece)
        pieces.append(piece)
    with bpy.context.temp_override(active_object=ob, selected_editable_objects=[ob, *pieces]):
        bpy.ops.object.join()
    counts['tris'] = len(ob.data.polygons)
    return counts


def chest_front(ob, z, x=0.0):
    """How far forward the shirt is at height z (its y, negative), so beards hang in front of it."""
    tree = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    hit = tree.ray_cast(Vector((x, -.6, z)), Vector((0, 1, 0)))
    return hit[0].y if hit[0] else -.2


def beard_shapes(ob, style):
    """The soft shapes (metaballs) of one beard on this face, in metres. The face is about
    0.115 m in front of the head's middle, the mouth at 1.047 m, the chin at about 0.94 m."""
    stache = [el((s * .042, -.138, 1.062), (.05, .024, .018), rot=(0, s * 20, 0)) for s in (-1, 1)]
    if style == 'stache':
        return stache
    sides = [el((s * .158, -.03, 1.06), (.036, .06, .08)) for s in (-1, 1)]
    jaw = [el((s * .118, -.088, .995), (.062, .062, .072)) for s in (-1, 1)]
    if style == 'chops':
        return sides + jaw + stache + [el((s * .085, -.125, 1.03), (.04, .035, .03)) for s in (-1, 1)]
    mass = [el((0, -.128, .965), (.125, .062, .07)), el((0, -.14, .905), (.1, .055, .05))]
    mouth_hole = el((0, -.17, 1.035), (.055, .07, .02), stiff=4, neg=True)
    E = mass + sides + jaw + stache + [mouth_hole]
    if style == 'long':
        # down over the belly in steps close enough to melt into one
        for k, z in enumerate((.87, .82, .77, .72, .67, .62)):
            r = .105 - k * .012
            E.append(el((0, chest_front(ob, z) - .035, z), (r, .055 - k * .003, .055)))
    if style == 'braids':
        for s in (-1, 1):
            for k, z in enumerate(BRAID_Z):
                r = .032 - k * .002
                E.append(el((s * .06, braid_y(ob, z), z), (r, r * .9, r * 1.15), stiff=3))
    return E


BRAID_Z = (.88, .83, .78, .73, .68, .635)


def braid_y(ob, z):
    return min(-.17, chest_front(ob, z, .06) - .03)


def beard_extras(ob, style):
    """Gold rings round the braids: (mesh, colour) pieces."""
    if style != 'braids':
        return []
    return [(dwarf_bodies.prim_mesh('ring', 'ball', (s * .06, braid_y(ob, z), z), (.033, .031, .011), sub=2), GOLD)
            for s in (-1, 1) for z in (BRAID_Z[2] + .025, BRAID_Z[4] + .025)]


def shade(me, hex_colour, material):
    """Paint a soft piece one colour, a little lighter where it faces up and darker underneath."""
    me.materials.clear()
    me.materials.append(material)
    base = Vector(common.hexc(hex_colour))
    attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    lo, hi = dwarf_bodies.SHADE_DOWN, dwarf_bodies.SHADE_UP
    for p in me.polygons:
        p.use_smooth = True
        for li in p.loop_indices:
            n = me.vertices[me.loops[li].vertex_index].normal
            attr.data[li].color = (*(base * (lo + (hi - lo) * (n.z * .5 + .5))), 1.0)
    return me


def build_beards(ob, B):
    """Every beard style as its own piece, <id>_Beard_<style>, on the body's clothes material so
    skin tone leaves it alone. The game shows the one the player picked."""
    mat = ob.data.materials[0]
    out = {}
    for style in BEARD_STYLES:
        name = '%s_Beard_%s' % (B['id'], style)
        old = bpy.data.objects.get(name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        big = style in ('long', 'braids')
        meshes = [shade(dwarf_bodies.meta_mesh('beard', beard_shapes(ob, style), .008,
                                               300 if style == 'stache' else 1100 if big else 800), B['beard'], mat)]
        meshes += [shade(m, c, mat) for m, c in beard_extras(ob, style)]
        piece = dwarf_bodies.join_meshes(name, meshes, ob.users_collection[0])
        out[style] = piece
    return out


# ---------------------------------------------------------------- skeleton

# The game's skeleton (Rig_Medium) fitted to the soft dwarves: the faceted dwarves' legs and hips,
# so seats, beds and the canoe still fit and moves keep their footing, with a longer chest that
# lifts the arms and head to where this body has them. Left side (+X); the right side mirrors it.
BONES = dict(
    dwarf_bodies.BONES,
    spine=((0, 0, .42), (0, 0, .64)),
    chest=((0, 0, .64), (0, 0, .88)),
    head=((0, 0, .9), (0, 0, 1.2)),
    upperarm=((.25, .07, .86), (.45, .08, .86)),
    lowerarm=((.45, .08, .86), (.57, .075, .85)),
    wrist=((.57, .075, .85), (.6, .075, .845)),
    hand=((.6, .075, .845), (.68, .07, .83)),
    handslot=((.66, .07, .8), (.66, 0, .8)),
    upperleg=((.14, .015, .36), (.14, .015, .22)),
    lowerleg=((.14, .015, .22), (.14, .02, .085)),
    foot=((.14, .02, .085), (.14, -.06, .03)),
    toes=((.14, -.06, .03), (.14, -.17, .03)),
)


def build_rig(name):
    """A copy of the game's skeleton (taken from a body file, so bone names and rolls match) with its
    bones moved to BONES."""
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(REPO, 'assets', 'characters', 'knight.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    rig = [o for o in new if o.type == 'ARMATURE'][0]
    for o in new:
        if o is not rig:
            bpy.data.objects.remove(o, do_unlink=True)
    rig.animation_data_clear()
    for key in list(rig.keys()):
        del rig[key]
    rig.name = rig.data.name = name
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for base, (h, t) in BONES.items():
        for side in ((1, -1) if base in dwarf_bodies.SIDED else (1,)):
            b = eb[dwarf_bodies.bone_name(base, side)]
            b.use_connect = False
            b.head = Vector(h if side > 0 else dwarf_bodies.mirror(h))
            b.tail = Vector(t if side > 0 else dwarf_bodies.mirror(t))
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return rig


def attach(ob, rig, beards):
    """Skin the body to the skeleton with Blender's automatic weights (each bone moves the skin
    nearest it, blending at the joints). Anything the automatic weights miss (the small face pieces
    are separate from the skin) follows the head; so do the beards, as on the faceted dwarves."""
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    deform = {b.name for b in rig.data.bones if b.use_deform}
    head = ob.vertex_groups.get('head') or ob.vertex_groups.new(name='head')
    groups = {g.index for g in ob.vertex_groups if g.name in deform}
    missed = [v.index for v in ob.data.vertices if sum(g.weight for g in v.groups if g.group in groups) < 1e-3]
    head.add(missed, 1.0, 'REPLACE')
    for piece in beards:
        piece.vertex_groups.clear()
        piece.vertex_groups.new(name='head').add(range(len(piece.data.vertices)), 1.0, 'REPLACE')
        piece.parent = rig
        piece.matrix_parent_inverse.identity()
        mod = piece.modifiers.get('Armature') or piece.modifiers.new('Armature', 'ARMATURE')
        mod.object = rig
    return len(missed)


# ---------------------------------------------------------------- into the game

def export_body(rig, game_id, tmp_dir):
    """Write the body, its beards and its skeleton to assets/characters/<game_id>.glb, at rest. The
    skeleton goes out under the game's name for it (Rig_Medium), marked softDwarf, so the game plays
    the soft dwarves' own moves on it (assets/animations/soft-dwarf.glb)."""
    import subprocess
    for pb in rig.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    old_name = rig.name
    rig['softDwarf'] = True
    meshes = [o for o in rig.children if o.type == 'MESH']
    for scene in bpy.data.scenes:  # only these, even if something is selected in another scene
        for layer in scene.view_layers:
            for o in layer.objects:
                o.select_set(False, view_layer=layer)
    for o in [rig, *meshes]:
        o.hide_set(False)
        o.hide_render = False
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    os.makedirs(tmp_dir, exist_ok=True)
    raw = os.path.join(tmp_dir, game_id + '.glb')
    rig.name = dwarf_bodies.SKELETON
    try:
        bpy.ops.export_scene.gltf(
            filepath=raw, export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True,
            export_apply=False, export_skins=True, export_animations=False,
            export_vertex_color='MATERIAL', export_all_vertex_colors=False, export_def_bones=False,
            export_materials='EXPORT', export_extras=True)
    finally:
        rig.name = old_name
    out = os.path.join(REPO, 'assets', 'characters', game_id + '.glb')
    subprocess.run(['node', os.path.join(REPO, 'tools', 'import-model.mjs'), raw, out, '--quantize'],
                   cwd=REPO, check=True, shell=os.name == 'nt')
    return {o.name: len(o.data.polygons) for o in meshes}
