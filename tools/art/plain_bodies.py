# The six plain bodies (Body 1 to Body 6) in just a shirt and shorts, and today's outfits saved as
# separate gear files (decision 0112). Built in Blender through the Blender MCP: exec this file, then
# call build_all(src_dir, repo_dir).
#
# src_dir holds the six Adventurers characters as they were before this change (KayKit, CC0, Kay
# Lousberg). They are in the git history:
#     git show 6ca39bc:assets/characters/knight.glb > <src_dir>/knight.glb   (and so on for all six)
#
# What it does, for each of the six:
# - Keeps the body's own skeleton (Rig_Medium), its four moves and its own head and hair.
# - Lifts every outfit piece off into gear: head pieces, back pieces and the whole outfit (chest, arms,
#   legs), each exported on the same skeleton to assets/gear/<name>.glb.
# - Draws a new Body, ArmLeft, ArmRight, LegLeft and LegRight: a short-sleeved shirt, shorts, bare arms,
#   bare legs and bare feet. Colours are vertex colours with a soft top-lit shading (decision 0107).
#   Joint weights are copied from the Rogue's own parts, so every move bends them the way it bent the
#   pack's characters. The hands are the Mage's bare hands from the same pack.
# - Body 6's hood was part of its head, so it is cut off into gear and Body 6 gets a chin-length bob
#   in its own hair colour (the hood hid its ears, and the bob covers where they would be).
#
# 1 unit = 1 m at the pack's own scale (the game draws the characters at 0.6). Facing -Y, Z up.
import math
import os
import re
import subprocess

import bpy
import bmesh
from mathutils import Vector

# id in the game, the part prefix in the pack, and what it is called on the character screen
BODIES = [
    ('knight', 'Knight', 'Body 1'),
    ('barbarian', 'Barbarian', 'Body 2'),
    ('mage', 'Mage', 'Body 3'),
    ('ranger', 'Ranger', 'Body 4'),
    ('rogue', 'Rogue', 'Body 5'),
    ('rogueHooded', 'RogueHooded', 'Body 6'),
]
LIMBS = ('Body', 'ArmLeft', 'ArmRight', 'LegLeft', 'LegRight')

# Soft, plain colours that sit with the forest, each a quiet nod to the outfit that body wore.
CLOTHES = {
    'knight': {'shirt': '#e6dcc4', 'shirt_trim': '#c9bc9f', 'shorts': '#6f7f8f', 'shorts_trim': '#5b6a79'},
    'barbarian': {'shirt': '#c98f6b', 'shirt_trim': '#a8714f', 'shorts': '#7b6350', 'shorts_trim': '#65503f'},
    'mage': {'shirt': '#a59ac4', 'shirt_trim': '#8a7eaa', 'shorts': '#5d5470', 'shorts_trim': '#4b435c'},
    'ranger': {'shirt': '#a9c6d8', 'shirt_trim': '#8eaec3', 'shorts': '#b49c78', 'shorts_trim': '#9a8262'},
    'rogue': {'shirt': '#9dba8e', 'shirt_trim': '#83a075', 'shorts': '#6f6550', 'shorts_trim': '#5b523f'},
    'rogueHooded': {'shirt': '#d6b86e', 'shirt_trim': '#bb9d57', 'shorts': '#5f7b78', 'shorts_trim': '#4d6663'},
}
# The Barbarian is the stockiest: a little broader through the chest, arms and legs.
BUILD = {'barbarian': 1.07}

# Gear lifted off each outfit: file name -> the pack's parts that make it.
GEAR = {
    'knight': {
        'knight-helmet': ['Helmet', 'HelmetVisor'],
        'knight-cape': ['Cape'],
        'knight-armour': list(LIMBS),
    },
    'barbarian': {
        'barbarian-bear-hat': ['BearHat'],
        'barbarian-outfit': list(LIMBS),
    },
    'mage': {
        'mage-hat': ['Hat'],
        'mage-cape': ['Cape'],
        'mage-robe': list(LIMBS),
    },
    'ranger': {
        'ranger-quiver': ['Quiver'],
        'ranger-cape': ['Cape'],
        'ranger-outfit': list(LIMBS),
    },
    'rogue': {
        'rogue-cape': ['Cape'],
        'rogue-outfit': list(LIMBS),
    },
    'rogueHooded': {
        'rogue-hood': ['Hood'],  # cut out of the head, below
        'rogue-mask': ['Mask'],
        'rogue-hooded-cape': ['Cape'],
        'rogue-hooded-outfit': list(LIMBS),
    },
}
# Gear that sits on the head, the back or the whole body (for the gallery and the try-on).
GEAR_SLOT = {
    'knight-helmet': 'head', 'barbarian-bear-hat': 'head', 'mage-hat': 'head', 'rogue-hood': 'head',
    'rogue-mask': 'face', 'knight-cape': 'back', 'mage-cape': 'back', 'ranger-cape': 'back',
    'rogue-cape': 'back', 'rogue-hooded-cape': 'back', 'ranger-quiver': 'back',
    'knight-armour': 'outfit', 'barbarian-outfit': 'outfit', 'mage-robe': 'outfit',
    'ranger-outfit': 'outfit', 'rogue-outfit': 'outfit', 'rogue-hooded-outfit': 'outfit',
}

# how much darker a corner facing down is, and lighter one facing up
SHADE_DOWN, SHADE_UP = .80, 1.06
SKELETON = 'Rig_Medium'


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def snake(name):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()


# ---------------------------------------------------------------------------------------------------
# Sources

def import_source(cid, src_dir):
    """Imports one of the pack's characters into its own collection, at the origin, in its rest pose."""
    before = set(bpy.data.objects)
    actions_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src_dir, cid + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    col = _collection('source_' + cid, hidden=True)
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
    # the importer's bone display shapes are not part of the model
    for o in [o for o in new if o.name.startswith('Icosphere') and o.parent is None]:
        bpy.data.objects.remove(o, do_unlink=True)
    rig = next(o for o in col.objects if o.type == 'ARMATURE')
    rig.name = 'rig_' + cid
    rig.data.name = 'rig_' + cid
    rig.data.pose_position = 'REST'
    for a in set(bpy.data.actions) - actions_before:
        a.name = cid + '|' + re.sub(r'\.\d+$', '', a.name)
    parts = {}
    for o in [o for o in col.objects if o.type == 'MESH']:
        parts[o.name.split('_', 1)[1]] = o
        o.name = 'source_' + o.name  # leaves the pack's names free for the new parts
        o.data.name = 'source_' + o.data.name
    return rig, parts


def _collection(name, hidden=False, parent=None):
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    parent = parent or bpy.context.scene.collection
    if col.name not in parent.children:
        parent.children.link(col)
    col.hide_render = hidden
    for layer in bpy.context.view_layer.layer_collection.children:
        if layer.collection == col:
            layer.exclude = False
    return col


def _texture_of(obj):
    mat = obj.data.materials[0]
    return next(n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE')


def _pixel_reader(img):
    w, h = img.size
    px = list(img.pixels)

    def at(uv):
        x = min(w - 1, max(0, int(uv[0] % 1.0 * w)))
        y = min(h - 1, max(0, int(uv[1] % 1.0 * h)))
        i = (y * w + x) * 4
        return px[i], px[i + 1], px[i + 2]
    return at


def face_colours(obj):
    """The texture colour under each face of a pack mesh (sRGB, as painted)."""
    at = _pixel_reader(_texture_of(obj))
    me = obj.data
    uv = me.uv_layers.active.data
    out = []
    for p in me.polygons:
        u = sum((uv[li].uv for li in p.loop_indices), Vector((0, 0))) / p.loop_total
        out.append(at(u))
    return out


def is_skin(c):
    r, g, b = c
    return r > .85 and g > .6 and .45 < b < .75 and r - b > .25


def is_hood_green(c):
    return c[0] < .1 and c[1] > .4


def skin_colour(head):
    """The head's own skin, weighted by area, so arms and legs match the face."""
    tally = {}
    for p, c in zip(head.data.polygons, face_colours(head)):
        if is_skin(c):
            key = tuple(round(x, 2) for x in c)
            tally[key] = tally.get(key, 0) + p.area
    return max(tally, key=tally.get)


# ---------------------------------------------------------------------------------------------------
# Shapes

def ring(centre, u, v, a, b, seg, n=2.6):
    """A soft, rounded-box loop (a superellipse) round centre in the plane of u and v."""
    pts = []
    for i in range(seg):
        t = 2 * math.pi * i / seg
        c, s = math.cos(t), math.sin(t)
        pts.append(centre + u * (math.copysign(abs(c) ** (2 / n), c) * a)
                   + v * (math.copysign(abs(s) ** (2 / n), s) * b))
    return pts


def loft(bm, rings, cap_start=False, cap_end=False):
    """Joins rings of equal length into a tube. Normals face out as long as u x v points the way the
    rings go; a ring that steps back inward makes a turned-in hem whose lining faces in."""
    seg = len(rings[0])
    faces, prev, first = [], None, None
    for pts in rings:
        vs = [bm.verts.new(p) for p in pts]
        if prev:
            for i in range(seg):
                faces.append(bm.faces.new((prev[i], prev[(i + 1) % seg], vs[(i + 1) % seg], vs[i])))
        else:
            first = vs
        prev = vs
    if cap_start:
        faces.append(bm.faces.new(first[::-1]))
    if cap_end:
        faces.append(bm.faces.new(prev))
    return faces


class Painter:
    """Builds one mesh, tagging every face with the colour it will be painted."""

    def __init__(self):
        self.bm = bmesh.new()
        self.part = self.bm.faces.layers.int.new('part')
        self.flat = self.bm.faces.layers.int.new('flat')
        self.names = []

    def tag(self, faces, name, flat=False):
        if name not in self.names:
            self.names.append(name)
        for f in faces:
            f[self.part] = self.names.index(name)
            f[self.flat] = 1 if flat else 0
        return faces

    def tube(self, rings, name, trims=(), caps=(False, False), flat_ends=True):
        """A loft whose bands listed in trims (by index of the ring they start at) take name + '_trim'."""
        seg = len(rings[0])
        faces = loft(self.bm, rings, *caps)
        for k in range(len(rings) - 1):
            band = faces[k * seg:(k + 1) * seg]
            self.tag(band, name + '_trim' if k in trims else name)
        ends = faces[(len(rings) - 1) * seg:]
        self.tag(ends, name, flat=flat_ends)
        return faces

    def to_mesh(self, name, palette):
        me = bpy.data.meshes.new(name)
        parts = [f[self.part] for f in self.bm.faces]
        flats = [f[self.flat] for f in self.bm.faces]
        self.bm.to_mesh(me)
        self.bm.free()
        paint(me, [palette[n] for n in self.names], parts, flats)
        return me


def paint(me, colours, parts, flats):
    """Vertex colours with a soft top-lit shading: tops lighter, undersides darker."""
    attr = me.attributes.get('part') or me.attributes.new('part', 'INT', 'FACE')
    for p, pi, fl in zip(me.polygons, parts, flats):
        p.use_smooth = not fl
        attr.data[p.index].value = pi
    me.update()
    col = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    me.color_attributes.active_color = col
    for p, pi in zip(me.polygons, parts):
        c = colours[pi]
        for li in p.loop_indices:
            nz = me.vertices[me.loops[li].vertex_index].normal.z if p.use_smooth else p.normal.z
            shade = SHADE_DOWN + (SHADE_UP - SHADE_DOWN) * (.5 + .5 * nz)
            col.data[li].color_srgb = (min(1, c[0] * shade), min(1, c[1] * shade), min(1, c[2] * shade), 1)


def clothes_material():
    mat = bpy.data.materials.get('plain_clothes')
    if mat:
        return mat
    mat = bpy.data.materials.new('plain_clothes')
    mat.use_nodes = True
    nt = mat.node_tree
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    bsdf = nt.nodes['Principled BSDF']
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = .85
    mat.use_backface_culling = False
    return mat


SEG = 16


def shirt_and_shorts(p, k):
    """Body: the shirt from the hem to the collar, and the shorts from the waist to above the knee."""
    up, x, y = Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0))

    def r(z, a, b, cy=.01, n=2.6):
        return ring(Vector((0, cy, z)), x, y, a * k, b * k, SEG, n)
    # shirt: turned-in hem, a hem band, the body, round shoulders, a collar band and a turned-in neck
    p.tube([r(.68, .27, .22), r(.60, .27, .22), r(.60, .318, .268), r(.655, .318, .268),
            r(.665, .308, .258), r(.80, .312, .256), r(.95, .318, .25), r(1.07, .31, .242),
            r(1.15, .285, .228), r(1.21, .225, .192), r(1.245, .155, .142), r(1.25, .14, .13),
            r(1.285, .13, .12), r(1.285, .10, .095), r(1.20, .10, .095)],
           'shirt', trims={2, 11})
    # shorts: the seat, closed, tucked up inside the shirt
    p.tube([r(.45, .24, .19), r(.47, .275, .222), r(.52, .296, .242), r(.64, .29, .236)],
           'shorts', caps=(True, True))
    # one short leg each side, with a turned-up hem
    for side in (1, -1):
        def lr(z, a, b):
            return ring(Vector((side * .168, 0, z)), x, y, a * k, b * k, SEG, 2.3)
        p.tube([lr(.43, .1, .1), lr(.355, .1, .1), lr(.355, .138, .142), lr(.40, .138, .142),
                lr(.405, .13, .134), lr(.50, .126, .13), lr(.57, .12, .12)],
               'shorts', trims={2}, caps=(False, True))


def bare_arm(p, side, k):
    """ArmLeft (side 1) or ArmRight (side -1): a short sleeve over a bare arm, out along X."""
    w = Vector((side, 0, 0))
    u, v = Vector((0, side, 0)), Vector((0, 0, 1))

    def r(xx, a, b=None, n=2.3):
        return ring(Vector((side * xx, 0, 1.107)), u, v, a * k, (b or a) * k, SEG, n)
    assert (u.cross(v) - w).length < 1e-6
    # bare arm, shoulder to wrist (the hand covers the wrist end)
    p.tube([r(.16, .10), r(.30, .1), r(.45, .093), r(.60, .085), r(.74, .076, .079), r(.815, .072, .075)],
           'skin', caps=(True, True), flat_ends=False)
    # the sleeve, with a hem band and a turned-in edge
    p.tube([r(.14, .118, .124), r(.25, .126, .133), r(.395, .13, .136), r(.405, .138, .143),
            r(.455, .138, .143), r(.455, .102, .102), r(.40, .102, .102)],
           'shirt', trims={3}, caps=(True, False))


def bare_leg(p, side, k):
    """LegLeft (side 1) or LegRight (side -1): a bare leg from inside the shorts to a bare foot."""
    up, x, y = Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0))
    cx = side * .171

    def cy(z):  # follows the bones: knee a touch forward, ankle a touch back
        return -.008 + (.019 + .008) * max(0, min(1, (.292 - z) / (.292 - .145))) if z < .292 else -.008 * (.519 - z) / (.519 - .292)

    def r(z, a, b):
        return ring(Vector((cx, cy(z), z)), x, y, a * k, b * k, SEG, 2.2)
    p.tube([r(.09, .07, .072), r(.18, .077, .079), r(.29, .086, .088), r(.40, .094, .095), r(.52, .1, .1)],
           'skin', caps=(True, True), flat_ends=False)
    # the foot, heel to toe along -Y, with a flat sole
    fw = Vector((0, -1, 0))
    fu, fv = Vector((1, 0, 0)), Vector((0, 0, 1))
    assert (fu.cross(fv) - fw).length < 1e-6

    def f(yy, a, zc, b):
        return ring(Vector((cx, yy, zc)), fu, fv, a * k, b, SEG, 2.4)
    faces = p.tube([f(.085, .052, .06, .05), f(.06, .076, .07, .07), f(0, .084, .072, .076),
                    f(-.08, .088, .06, .06), f(-.16, .088, .052, .052), f(-.205, .077, .046, .046),
                    f(-.232, .052, .04, .034)], 'skin', caps=(True, True), flat_ends=False)
    for fa in faces:
        for vtx in fa.verts:
            vtx.co.z = max(vtx.co.z, 0.0)


# ---------------------------------------------------------------------------------------------------
# Weights

def copy_weights(target, source):
    """Gives target the joint weights of the nearest surface of source (same skeleton, rest pose)."""
    for g in source.vertex_groups:
        if g.name not in target.vertex_groups:
            target.vertex_groups.new(name=g.name)
    m = target.modifiers.new('copy_weights', 'DATA_TRANSFER')
    m.object = source
    m.use_object_transform = True
    m.use_vert_data = True
    m.data_types_verts = {'VGROUP_WEIGHTS'}
    m.vert_mapping = 'POLYINTERP_NEAREST'
    m.layers_vgroup_select_src = 'ALL'
    m.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.update()
    with bpy.context.temp_override(object=target, active_object=target, selected_objects=[target],
                                   selected_editable_objects=[target]):
        bpy.ops.object.modifier_apply(modifier=m.name)
        bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
        bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)


def bind(obj, rig):
    obj.parent = rig
    m = obj.modifiers.get('Armature') or obj.modifiers.new('Armature', 'ARMATURE')
    m.object = rig


# ---------------------------------------------------------------------------------------------------
# Gear and heads

def islands_of(me):
    """Groups of face indices that are joined to each other."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    seen, out = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, comp = [f], []
        seen.add(f.index)
        while stack:
            a = stack.pop()
            comp.append(a.index)
            for e in a.edges:
                for b in e.link_faces:
                    if b.index not in seen:
                        seen.add(b.index)
                        stack.append(b)
        out.append(comp)
    bm.free()
    return out


def copy_object(obj, name, col):
    c = obj.copy()
    c.data = obj.data.copy()
    c.name = name
    c.data.name = name
    col.objects.link(c)
    return c


def keep_faces(obj, keep):
    """Deletes every face of obj not in keep, and any vertex left loose."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
    bm.to_mesh(obj.data)
    bm.free()


def split_hood(head, col):
    """Body 6's hood is part of its head: cut the green hood off into a piece of its own."""
    colours = face_colours(head)
    green = {i for i, c in enumerate(colours) if is_hood_green(c)}
    hood = copy_object(head, 'RogueHooded_Hood', col)
    keep_faces(hood, green)
    keep_faces(head, set(range(len(colours))) - green)
    return hood


def bare_hands(mage_arm, side, col):
    """The Mage's bare hand, from the island past the wrist painted in skin."""
    colours = face_colours(mage_arm)
    me = mage_arm.data
    keep = set()
    for isl in islands_of(me):
        xs = [me.vertices[v].co.x * side for i in isl for v in me.polygons[i].vertices]
        skin = sum(1 for i in isl if is_skin(colours[i])) > len(isl) / 2
        if min(xs) > .79 and skin:
            keep |= set(isl)  # the palm and fingers, and the thumb if it is a piece of its own
    if len(keep) < 20:
        raise RuntimeError('no bare hand on ' + mage_arm.name)
    hand = copy_object(mage_arm, 'hand', col)
    keep_faces(hand, keep)
    hand.modifiers.clear()
    hand.parent = None
    return hand


def bob(head, hair_rgb, col):
    """A chin-length bob for Body 6, shaped round its head, open at the face."""
    me = head.data
    vs = [v.co for v in me.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    c = (lo + hi) / 2
    c.z = hi.z - .37
    p = Painter()
    x, y = Vector((1, 0, 0)), Vector((0, 1, 0))
    rings = []
    for z, s in [(-.30, .93), (-.26, 1.0), (-.1, 1.05), (.06, 1.04), (.2, .96), (.3, .78), (.36, .5), (.39, .18)]:
        rings.append(ring(Vector((c.x, c.y + .02, c.z + z)), x, y, .49 * s, .47 * s, 20, 2.2))
    faces = p.tube(rings, 'hair', caps=(False, True))
    # open the face: drop the front of the lower rings
    bm = p.bm
    hairline = c.z + .22
    drop = [f for f in faces if f.is_valid and f.calc_center_median().y < c.y - .2
            and f.calc_center_median().z < hairline - .5 * f.calc_center_median().x ** 2
            and abs(f.calc_center_median().x) < .4]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    # a thickness, so the open edges read as a cut of hair
    ret = bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=-.035)
    for f in bm.faces:
        f[p.part] = 0
    obj = bpy.data.objects.new('hair', p.to_mesh('hair', {'hair': hair_rgb}))
    col.objects.link(obj)
    # all of it moves with the head
    obj.vertex_groups.new(name='head').add(range(len(obj.data.vertices)), 1.0, 'REPLACE')
    return obj


# ---------------------------------------------------------------------------------------------------
# Building

def build_body(cid, prefix, rig, parts, ref, mage, col):
    """The five plain parts for one body, skinned to its own rig."""
    k = BUILD.get(cid, 1.0)
    skin = skin_colour(parts['Head'])
    palette = {name: hexc(h) for name, h in CLOTHES[cid].items()}
    palette['skin'] = skin
    palette['skin_trim'] = skin
    mat = clothes_material()
    made = {}
    for limb in LIMBS:
        p = Painter()
        if limb == 'Body':
            shirt_and_shorts(p, k)
        elif limb.startswith('Arm'):
            bare_arm(p, 1 if limb == 'ArmLeft' else -1, k)
        else:
            bare_leg(p, 1 if limb == 'LegLeft' else -1, k)
        name = prefix + '_' + limb
        obj = bpy.data.objects.new(name, p.to_mesh(name, palette))
        col.objects.link(obj)
        obj.data.materials.append(mat)
        copy_weights(obj, ref[limb])
        if limb.startswith('Arm'):
            hand = bare_hands(mage[limb], 1 if limb == 'ArmLeft' else -1, col)
            hand.data.materials.clear()
            hand.data.materials.append(mat)
            n = len(hand.data.polygons)
            paint(hand.data, [skin], [0] * n, [0] * n)
            with bpy.context.temp_override(active_object=obj, object=obj,
                                           selected_objects=[obj, hand], selected_editable_objects=[obj, hand]):
                bpy.ops.object.join()
            obj.data.materials.clear()
            obj.data.materials.append(mat)
            for f in obj.data.polygons:
                f.material_index = 0
        for uv in list(obj.data.uv_layers):
            obj.data.uv_layers.remove(uv)
        bind(obj, rig)
        made[limb] = obj
    return made, skin


def export_glb(objects, rig, path, animations):
    """Exports the rig and these meshes to a .glb with the names the game reads."""
    others = [o for o in bpy.data.objects if o.name == SKELETON and o != rig]
    for o in others:
        o.name = SKELETON + '_away'
    old = rig.name
    rig.name = SKELETON
    # Each of the pack's four moves sits on an NLA track named as the game knows it
    # (Idle_A_Rig_Medium and so on), so the tracks are exported, and only this body's own.
    ad = rig.animation_data
    active = ad.action if ad else None
    if ad:
        ad.action = None
    rig.data.pose_position = 'POSE'
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    hidden = []
    for o in [rig, *objects]:
        if o.hide_get():
            hidden.append(o)
            o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    try:
        bpy.ops.export_scene.gltf(
            filepath=path, export_format='GLB', use_selection=True, export_yup=True,
            export_apply=False, export_skins=True, export_animations=animations,
            export_animation_mode='NLA_TRACKS', export_vertex_color='MATERIAL',
            export_all_vertex_colors=False, export_def_bones=False, export_materials='EXPORT')
    finally:
        rig.data.pose_position = 'REST'
        if ad:
            ad.action = active
        rig.name = old
        for o in others:
            o.name = SKELETON
        for o in hidden:
            o.hide_set(True)


def compress(repo_dir, raw, out):
    subprocess.run(['node', os.path.join(repo_dir, 'tools', 'import-model.mjs'), raw, out],
                   cwd=repo_dir, check=True, shell=os.name == 'nt')


def build_all(src_dir, repo_dir, tmp_dir, export=True):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    # leftovers from an earlier build would push .001 onto the new names
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    sources = {cid: import_source(cid, src_dir) for cid, _, _ in BODIES}
    ref = {limb: sources['rogue'][1][limb] for limb in LIMBS}
    mage = sources['mage'][1]
    report = {}
    for cid, prefix, label in BODIES:
        rig, parts = sources[cid]
        gear_col = _collection('gear_' + cid)
        body_col = _collection('body_' + cid)
        rig_col = rig.users_collection[0]
        # gear first, while the parts are still the pack's own
        if cid == 'rogueHooded':
            parts['Hood'] = split_hood(parts['Head'], rig_col)
            bind(parts['Hood'], rig)
        gear = {}
        for name, pieces in GEAR[cid].items():
            objs = []
            for piece in pieces:
                o = copy_object(parts[piece], gear_object_name(name, piece, len(pieces)), gear_col)
                bind(o, rig)
                objs.append(o)
            gear[name] = objs
        body, skin = build_body(cid, prefix, rig, parts, ref, mage, body_col)
        head = copy_object(parts['Head'], prefix + '_Head', body_col)
        bind(head, rig)
        body['Head'] = head
        if cid == 'rogueHooded':
            fringe = [c for c in face_colours(parts['Head']) if c[0] > .5 and c[1] < .45 and c[2] < .35]
            hair_rgb = tuple(sum(c[i] for c in fringe) / len(fringe) for i in range(3))
            # a part of its own, so the head keeps its painted texture untouched
            hair = bob(parts['Head'], hair_rgb, body_col)
            hair.name = hair.data.name = prefix + '_Hair'
            hair.data.materials.append(clothes_material())
            bind(hair, rig)
            body['Hair'] = hair
        report[cid] = {limb: tri_count(o) for limb, o in body.items()}
        report[cid]['total'] = sum(report[cid].values())
        if export:
            raw = os.path.join(tmp_dir, cid + '.glb')
            export_glb(list(body.values()), rig, raw, animations=True)
            compress(repo_dir, raw, os.path.join(repo_dir, 'assets', 'characters', cid + '.glb'))
            for name, objs in gear.items():
                raw = os.path.join(tmp_dir, name + '.glb')
                export_glb(objs, rig, raw, animations=False)
                compress(repo_dir, raw, os.path.join(repo_dir, 'assets', 'gear', name + '.glb'))
    return report


def gear_object_name(gear, piece, count):
    """knight-helmet + HelmetVisor -> knight_helmet_visor; knight-armour + ArmLeft -> knight_armour_arm_left."""
    base = gear.replace('-', '_')
    if count == 1:
        return base
    last, rest = base.rsplit('_', 1)[1], snake(piece)
    if rest == last:
        return base
    if rest.startswith(last + '_'):
        rest = rest[len(last) + 1:]
    return base + '_' + rest


def tri_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)
