# Every upper-body top, fitted to the two soft bodies (decision 0284). Run inside Blender through
# the Blender MCP, with REPO set to this repository's folder:
#
#     REPO = r'<repo>'
#     exec(open(REPO + r'\tools\art\soft_tops.py').read())
#     build()                         # both bodies side by side, each wearing every top
#     render_views(out_dir, 'linen_shirt')
#     export_all(tmp_dir)             # assets/gear/<file>.glb for every top
#
# Each top is cut from the body it is for: everything that isn't skin from the hem up, and as much
# of the arms as its sleeves cover, pushed out over the skin and kept on that body's own skin
# weights, so it bends and twists exactly as the body does. Its edges are straightened, and bands
# (collar, cuffs, belt, trim) are cut in with flat planes and stand a little proud. The coat's skirt
# is built round both legs instead, and follows them halfway, so it swings as you walk.
#
# The bodies share one skeleton and rest pose (decision 0272), so both fits of a top go in one
# file on that skeleton, named <top>_body1 and <top>_body2; the game picks the one for the body
# wearing it. Facing -Y, Z up, the arms out along X, as the bodies are.
import math
import os
import subprocess

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

REPO = globals().get('REPO') or os.getcwd()
BODY2_X = 1.2

# The bodies' own landmarks (from their skeleton): the arms run out along X at this height.
ARM_Z = 0.86
SHOULDER_X = 0.25
ELBOW_X = 0.45
WRIST_X = 0.56
WAIST_Z = 0.47
HEM_Z = 0.40

# top -> its file, how far its sleeves and hem reach, how far it stands off the skin, its colour,
# and its bands: (name, axis, from, to, colour, how much prouder). 'neck' bands run along the
# neckline instead, this far down from it.
TOPS = {
    'linen_shirt': dict(
        file='linen-shirt', sleeve_x=WRIST_X - 0.012, hem_z=HEM_Z, stand=0.012, colour='b5ab8b',
        bands=[('cuff', 'x', WRIST_X - 0.05, WRIST_X, '978d70', 0.006),
               ('hem', 'z', HEM_Z, HEM_Z + 0.03, '978d70', 0.004),
               ('collar', 'neck', 0.0, 0.03, '978d70', 0.004)]),
    'traveler_tunic': dict(
        file='traveler-tunic', sleeve_x=ELBOW_X + 0.035, hem_z=0.34, stand=0.018, colour='5f8a55',
        bands=[('trim', 'z', 0.34, 0.37, '466a3f', 0.005),
               ('cuff', 'x', ELBOW_X + 0.005, ELBOW_X + 0.035, '466a3f', 0.006),
               ('belt', 'z', WAIST_Z - 0.03, WAIST_Z + 0.015, '6b4a2e', 0.012),
               ('collar', 'neck', 0.0, 0.03, '466a3f', 0.005)],
        buckle='c9a24a'),
    'winter_jacket': dict(
        file='winter-jacket', sleeve_x=WRIST_X - 0.005, hem_z=HEM_Z - 0.02, stand=0.028, colour='8a483b',
        bands=[('cuff', 'x', WRIST_X - 0.06, WRIST_X, 'e8dcc0', 0.014),
               ('hem', 'z', HEM_Z - 0.02, HEM_Z + 0.02, '6e382e', 0.008),
               ('collar', 'neck', 0.0, 0.05, 'e8dcc0', 0.018)],
        quilted=True),
    'cedarstalker_coat': dict(
        file='cedarstalker-coat', sleeve_x=WRIST_X - 0.005, hem_z=HEM_Z - 0.02, stand=0.022, colour='42634b',
        bands=[('cuff', 'x', WRIST_X - 0.05, WRIST_X, '7a5a3a', 0.01),
               ('belt', 'z', WAIST_Z - 0.03, WAIST_Z + 0.015, '4a3524', 0.012),
               ('collar', 'neck', 0.0, 0.045, '7a5a3a', 0.012)],
        skirt=dict(top=HEM_Z + 0.02, bottom=0.2, flare=0.05, trim=('7a5a3a', 0.035)), buckle='a8a08a'),
}
# Each fit of a top stays within the props' 2,000-triangle budget.
BUDGET = 1950
# How far down from the neckline the top keeps all of the body's detail, and the name of the
# vertex group that marks it while the rest is lowered.
NECK_DETAIL = 0.06
DETAIL = '_neck_detail'


def linear(hex_colour):
    return tuple((int(hex_colour[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)) + (1.0,)


def plain_material(name, hex_colour, roughness=0.95):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = linear(hex_colour)
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def collection(name):
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    return col


def import_bodies():
    """Body 1 and Body 2 from the game's own files, at rest (the same as tools/art/soft_hats.py)."""
    rigs = {}
    for game_id, x in (('knight', 0.0), ('barbarian', BODY2_X)):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(REPO, 'assets', 'characters', game_id + '.glb'))
        new = [o for o in bpy.data.objects if o not in before]
        rig = [o for o in new if o.type == 'ARMATURE'][0]
        for o in new:
            if o.type == 'MESH' and o.parent is None:
                bpy.data.objects.remove(o, do_unlink=True)  # bone shapes
        rig.name = 'rig_' + game_id
        rig.location.x = x
        rig.animation_data_clear()
        for pb in rig.pose.bones:
            pb.matrix_basis.identity()
        for o in rig.children:
            if '_Beard_' in o.name:
                keep = o.name.startswith('body1_Beard_braids')
                o.hide_set(not keep)
                o.hide_render = not keep
        rigs[game_id] = rig
    bpy.context.view_layer.update()
    return rigs


def is_skin(colour):
    """Skin, lips, brows and hair are all warm and bright; the clothes are cream or brown."""
    r, g, b = colour
    return r > 0.6 and g < 0.6 and b < 0.4


def at_neck(co):
    """Round the neck: high up, and close to the body's middle (not an armpit or a shoulder)."""
    return co.z > 0.78 and co.xy.length < 0.24 and not on_arm(co)


def on_arm(co):
    return abs(co.x) >= SHOULDER_X - 0.02 and ARM_Z - 0.2 < co.z < 1.0


def by_colour(spec):
    """A first, rough cut: everything that isn't skin, down to the hem and out along the sleeves."""
    def test(face, colour):
        centre = face.calc_center_median()
        if on_arm(centre):
            return abs(centre.x) <= spec['sleeve_x'] + 0.03
        return spec['hem_z'] - 0.03 <= centre.z <= 1.02 and not is_skin(colour)
    return test


def below(neckline, spec):
    """The real cut: everything under a smooth neckline, whatever its colour (so the plain shirt's
    pointed collar and the skin in its open neck are covered), but not the underside of a chin."""
    def test(face, colour):
        centre = face.calc_center_median()
        if on_arm(centre):
            return abs(centre.x) <= spec['sleeve_x'] + 0.03
        if is_skin(colour) and face.normal.z < -0.2:
            return False
        return spec['hem_z'] - 0.03 <= centre.z <= neckline(centre)
    return test


def fit_neckline(bm):
    """A smooth line round the neck, fitted to where the plain shirt meets the skin: its height
    as a gentle curve of the angle round the neck, lowest at the front."""
    neck = [v.co.copy() for v in boundary_verts(bm) if at_neck(v.co)]
    middle_y = sum(n.y for n in neck) / len(neck)

    def angle(co):
        return math.atan2(co.x, -(co.y - middle_y))
    terms = [lambda a: 1.0, math.cos, lambda a: math.cos(2 * a)]
    rows = [[f(angle(n)) for f in terms] for n in neck]
    # Least squares for the three terms, by the normal equations (3 x 3).
    m = [[sum(r[i] * r[j] for r in rows) for j in range(3)] for i in range(3)]
    b = [sum(r[i] * n.z for r, n in zip(rows, neck)) for i in range(3)]
    k = Matrix(m).inverted() @ Vector(b)

    def height(co):
        a = angle(co)
        return sum(c * f(a) for c, f in zip(k, terms)) - 0.004
    return height


def body_at_origin(body):
    """A copy of `body`'s mesh where Body 1 stands, still carrying its skin weights."""
    copy = body.copy()
    copy.data = body.data.copy()
    for mod in list(copy.modifiers):
        copy.modifiers.remove(mod)
    copy.parent = None
    copy.matrix_world = Matrix.Identity(4)
    copy.data.transform(Matrix.Translation(-body.matrix_world.translation) @ body.matrix_world)
    return copy


def boundary_verts(bm):
    return {v for e in bm.edges if e.is_boundary for v in e.verts}


def straighten_edges(bm, spec):
    """Every open edge but the neckline snapped flat: the hem to its height, a cuff round the arm."""
    for v in boundary_verts(bm):
        if on_arm(v.co) and abs(v.co.x) > SHOULDER_X + 0.08:
            v.co.x = math.copysign(spec['sleeve_x'], v.co.x)
        elif v.co.z < spec['hem_z'] + 0.06:
            v.co.z = spec['hem_z']


def keep_only(bm, keep):
    """Deletes every face `keep` turns down, then all but the biggest piece left (no stray specks
    from round the face), and closes small holes (a stray skin-coloured face on the chest); the
    neck, hem and cuffs are far bigger than those."""
    colours = bm.loops.layers.float_color.get('Color') or bm.loops.layers.color.get('Color')
    bm.normal_update()
    drop = []
    for face in bm.faces:
        cs = [loop[colours][:3] for loop in face.loops]
        if not keep(face, tuple(sum(c[i] for c in cs) / len(cs) for i in range(3))):
            drop.append(face)
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    pieces, seen = [], set()
    for face in bm.faces:
        if face in seen:
            continue
        piece, stack = [], [face]
        seen.add(face)
        while stack:
            f = stack.pop()
            piece.append(f)
            for e in f.edges:
                for other in e.link_faces:
                    if other not in seen:
                        seen.add(other)
                        stack.append(other)
        pieces.append(piece)
    pieces.sort(key=len)
    bmesh.ops.delete(bm, geom=[f for p in pieces[:-1] for f in p], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=12)
    bm.normal_update()


def cut_from_body(body, spec, name, into):
    """The part of `body` the top covers, as its own object on the body's skin weights."""
    top = body_at_origin(body)
    top.name = top.data.name = name
    into.objects.link(top)
    rough = bmesh.new()
    rough.from_mesh(top.data)
    keep_only(rough, by_colour(spec))
    neckline = fit_neckline(rough)
    rough.free()
    bm = bmesh.new()
    bm.from_mesh(top.data)
    keep_only(bm, below(neckline, spec))
    bm.verts.index_update()
    neck = [v for v in boundary_verts(bm) if at_neck(v.co)]
    detail = {v.index: max(0.0, 1 - min((v.co - n.co).length for n in neck) / NECK_DETAIL)
              for v in bm.verts if neck and v.co.z > 0.7}
    stand, quilted = spec['stand'], spec.get('quilted', False)
    for v in bm.verts:
        out = stand
        if quilted:  # padded rows round the body and down the sleeves
            along = abs(v.co.x) if on_arm(v.co) else v.co.z
            out += 0.012 * abs(math.sin(along * math.pi / 0.07))
        v.co += v.normal * out
    straighten_edges(bm, spec)
    for v in neck:  # onto the smooth neckline, now it stands off the skin
        v.co.z = neckline(v.co) + 0.004
    bm.to_mesh(top.data)
    bm.free()
    for attr in list(top.data.color_attributes):
        top.data.color_attributes.remove(attr)
    top.data.materials.clear()
    group = top.vertex_groups.new(name=DETAIL)
    for index, weight in detail.items():
        if weight > 0:
            group.add([index], weight, 'REPLACE')
    return top


def apply_modifier(ob, mod):
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def triangles(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def lower_poly(top, target):
    if triangles(top) > target:
        mod = top.modifiers.new('Decimate', 'DECIMATE')
        mod.ratio = target / triangles(top)
        mod.use_collapse_triangulate = True
        mod.vertex_group = DETAIL  # the neckline keeps its shape: the shirt collar under it has fine points
        mod.invert_vertex_group = True
        apply_modifier(top, mod)
    top.vertex_groups.remove(top.vertex_groups[DETAIL])


def neck_distance(bm):
    """How far each vertex is below the neckline (the open edge round the neck)."""
    neck = [v.co.copy() for v in boundary_verts(bm) if at_neck(v.co)]

    def nearest(co):
        return min(neck, key=lambda n: (co - n).length) if neck else co + Vector((0, 0, 1))

    def distance(co):
        return (co - nearest(co)).length
    distance.nearest = nearest
    return distance


def smooth_along(verts, surface, rounds=6):
    """Evens out a ragged line of vertices: each one moved towards the middle of its neighbours
    on the line, then back onto the top's surface."""
    for _round in range(rounds):
        moved = {}
        for v in verts:
            neighbours = [e.other_vert(v) for e in v.link_edges if e.other_vert(v) in verts]
            if len(neighbours) == 2:
                middle = (neighbours[0].co + neighbours[1].co) / 2
                moved[v] = v.co.lerp(middle, 0.6)
        for v, co in moved.items():
            hit = surface.find_nearest(co)[0]
            v.co = hit if hit is not None else co


def smooth_neck_band_edges(bm, spec):
    """The collar's lower edge, which runs between faces rather than along a cut, evened out."""
    neck_bands = {index for index, b in enumerate(spec['bands'], start=1) if b[1] == 'neck'}
    if not neck_bands:
        return
    edge = set()
    for e in bm.edges:
        if len(e.link_faces) == 2 and len({f.material_index in neck_bands for f in e.link_faces}) == 2:
            edge.update(e.verts)
    smooth_along(edge, BVHTree.FromBMesh(bm))


def cut_bands(top, spec, mats):
    """Flat cuts at each band's edges, then each band in its own colour, standing proud."""
    bm = bmesh.new()
    bm.from_mesh(top.data)
    for _name, axis, lo, hi, _colour, _proud in spec['bands']:
        for at in (lo, hi):
            if axis == 'neck':
                continue
            planes = [((0, 0, at), (0, 0, 1))] if axis == 'z' else [((s * at, 0, 0), (1, 0, 0)) for s in (1, -1)]
            for co, no in planes:
                geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
                bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
    bm.normal_update()
    below_neck = neck_distance(bm)
    proud = {}
    for face in bm.faces:
        c = face.calc_center_median()
        face.material_index = 0
        for index, (_name, axis, lo, hi, _colour, lift) in enumerate(spec['bands'], start=1):
            if axis == 'neck':
                inside = not on_arm(c) and below_neck(c) <= hi
            elif axis == 'x':
                inside = on_arm(c) and lo <= abs(c.x) <= hi
            else:
                inside = not on_arm(c) and lo <= c.z <= hi
            if inside:
                face.material_index = index
                for v in face.verts:
                    proud[v] = max(proud.get(v, 0.0), lift)
    smooth_neck_band_edges(bm, spec)
    for v, lift in proud.items():
        v.co += v.normal * lift
    bm.to_mesh(top.data)
    bm.free()
    for m in mats:
        top.data.materials.append(m)


def add_rim(top, depth=0.008):
    """The open edges turned in towards the skin, so a hem or cuff has some thickness."""
    mod = top.modifiers.new('Rim', 'SOLIDIFY')
    mod.thickness = depth
    mod.offset = -1
    mod.use_rim = True
    mod.use_rim_only = True
    apply_modifier(top, mod)


def silhouette(body):
    """How far out the body reaches from its middle, in a given direction at a given height."""
    tree = surface_of(body)

    def reach(z, angle):
        d = Vector((math.cos(angle), math.sin(angle), 0))
        start = Vector((0, 0, z)) + d * 1.0
        hit = tree.ray_cast(start, -d, 1.0)[0]
        return (hit.xy.length if hit is not None else 0.2)
    return reach


def build_skirt(top, body, spec, segments=28):
    """The coat's skirt: rings round both legs from under the belt to above the knees, flaring
    out, with a trim at the bottom. It takes the weights of the body under it, half of them
    given to the hips, so it follows the legs halfway."""
    skirt = spec['skirt']
    copy = body_at_origin(body)
    bpy.context.scene.collection.objects.link(copy)
    reach = silhouette(body)
    heights = [skirt['top'] - (skirt['top'] - skirt['bottom']) * k / 5 for k in range(6)]
    heights.insert(5, skirt['bottom'] + skirt['trim'][1])
    bm = bmesh.new()
    rings = []
    for z in heights:
        depth = (skirt['top'] - z) / (skirt['top'] - skirt['bottom'])
        ring = []
        for k in range(segments):
            angle = 2 * math.pi * k / segments
            out = max(reach(z, angle), reach(max(z, HEM_Z - 0.02), angle)) + spec['stand'] + 0.012
            out += skirt['flare'] * depth ** 1.4
            ring.append(bm.verts.new((math.cos(angle) * out, math.sin(angle) * out, z)))
        rings.append(ring)
    for index, (a, b) in enumerate(zip(rings, rings[1:])):
        for k in range(segments):
            f = bm.faces.new((a[k], b[k], b[(k + 1) % segments], a[(k + 1) % segments]))
            f.material_index = len(top.data.materials) if index == len(rings) - 2 else 0
    mesh = bpy.data.meshes.new(top.name + '_skirt')
    bm.to_mesh(mesh)
    bm.free()
    for m in top.data.materials:
        mesh.materials.append(m)
    mesh.materials.append(plain_material(top.name.rsplit('_body', 1)[0] + '_hem_mat', skirt['trim'][0]))
    part = bpy.data.objects.new(top.name + '_skirt', mesh)
    for collection_ in top.users_collection:
        collection_.objects.link(part)
    for group in copy.vertex_groups:
        part.vertex_groups.new(name=group.name)
    transfer = part.modifiers.new('Weights', 'DATA_TRANSFER')
    transfer.object = copy
    transfer.use_vert_data = True
    transfer.data_types_verts = {'VGROUP_WEIGHTS'}
    transfer.vert_mapping = 'POLYINTERP_NEAREST'
    apply_modifier(part, transfer)
    hips = part.vertex_groups['hips']
    for v in part.data.vertices:
        legs = 0.0
        for g in v.groups:
            if part.vertex_groups[g.group].name.startswith(('upperleg', 'lowerleg')):
                g.weight *= 0.5
                legs += g.weight
        if legs > 0:
            hips.add([v.index], legs + next((g.weight for g in v.groups if g.group == hips.index), 0.0), 'REPLACE')
    bpy.data.objects.remove(copy, do_unlink=True)
    return part


def add_buckle(top, body, colour):
    """A small square buckle on the front of the belt, on the spine bone."""
    z = WAIST_Z - 0.008
    hit = surface_of(body).ray_cast(Vector((0, -1, z)), Vector((0, 1, 0)), 2.0)[0]
    front = (hit.y if hit is not None else -0.25) - 0.04
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.055, 0.014, 0.045), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, front, z), verts=bm.verts)
    mesh = bpy.data.meshes.new(top.name + '_buckle')
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(plain_material(top.name.rsplit('_body', 1)[0] + '_buckle_mat', colour, roughness=0.5))
    part = bpy.data.objects.new(top.name + '_buckle', mesh)
    for collection_ in top.users_collection:
        collection_.objects.link(part)
    part.vertex_groups.new(name='spine').add(range(len(mesh.vertices)), 1.0, 'REPLACE')
    return part


def join(parts):
    if len(parts) > 1:
        with bpy.context.temp_override(active_object=parts[0], object=parts[0], selected_objects=parts,
                                       selected_editable_objects=parts):
            bpy.ops.object.join()
    return parts[0]


def surface_of(body):
    """The body's own skin and clothes, where Body 1 stands, to cast rays against."""
    offset = body.matrix_world.translation
    verts = [(body.matrix_world @ v.co) - offset for v in body.data.vertices]
    return BVHTree.FromPolygons(verts, [list(p.vertices) for p in body.data.polygons])


def hair_over(body):
    """Every beard and the hair the body can have, where Body 1 stands, to keep the top under."""
    owner = body.parent
    verts, polys = [], []
    for o in owner.children:
        if o.type == 'MESH' and o is not body and o.name.startswith(body.name + '_'):
            base = len(verts)
            verts += [(o.matrix_world @ v.co) - body.matrix_world.translation for v in o.data.vertices]
            polys += [[base + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, polys) if polys else None


def keep_over_body(top, body, reach=0.04, clear=0.005):
    """Pushes the top back out wherever the body pokes through it (the plain shirt's pointed
    collar, mostly), so nothing of the shirt shows through what is worn over it."""
    surface = surface_of(body)
    for v in top.data.vertices:
        n = v.normal
        hit, _normal, _index, distance = surface.ray_cast(v.co + n * 0.0005, n, reach)
        if hit is not None:
            v.co = hit + n * clear


def keep_under_hair(top, body, gap=0.006, depth=0.1, over_shirt=0.012):
    """Pulls the top back wherever it would cover a braid or a beard lying on the chest, though
    never closer than `over_shirt` to the plain shirt, whose creases would poke through."""
    hair = hair_over(body)
    if hair is None:
        return
    skin = surface_of(body)
    for v in top.data.vertices:
        if v.co.y > 0 or on_arm(v.co):
            continue  # only the front of the body has hair hanging over it
        n = v.normal
        inner = v.co - n * depth
        hit, _normal, _index, distance = hair.ray_cast(inner, n, depth + 0.01)
        if hit is None or distance >= depth + gap:
            continue
        # The outermost layer of the body under this point (its shirt, not the skin beneath it).
        under = skin.ray_cast(v.co, -n, depth)[3]
        floor = depth - (under if under is not None else 0.0) + over_shirt
        v.co = inner + n * max(distance - gap, floor)


def on_rig(top, rig):
    """Worn by `rig`, standing where it stands (the mesh is built where Body 1 stands)."""
    top.parent = rig
    top.matrix_parent_inverse = Matrix.Identity(4)
    top.matrix_basis = Matrix.Identity(4)
    mod = top.modifiers.get('Armature') or top.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig


def build_top(name, spec, body, rig, into, share=0.6):
    top = cut_from_body(body, spec, name, into)
    extras = 28 * 6 * 2 + 12 if 'skirt' in spec else 12
    lower_poly(top, (BUDGET - extras) * share)
    mats = [plain_material(name.rsplit('_body', 1)[0] + '_mat', spec['colour'])]
    mats += [plain_material(f"{name.rsplit('_body', 1)[0]}_{b[0]}_mat", b[4]) for b in spec['bands']]
    cut_bands(top, spec, mats)
    keep_over_body(top, body)
    keep_under_hair(top, body)
    add_rim(top)
    parts = [top]
    if 'skirt' in spec:
        parts.append(build_skirt(top, body, spec))
    if 'buckle' in spec:
        parts.append(add_buckle(top, body, spec['buckle']))
    top = join(parts)
    top.name = top.data.name = name
    on_rig(top, rig)
    for p in top.data.polygons:
        p.use_smooth = True
    return top


def build(only=None):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    rigs = import_bodies()
    tops = collection('soft_tops')
    made = {}
    for name, spec in TOPS.items():
        if only and name not in only:
            continue
        for body_name in ('body1', 'body2'):
            body, share = bpy.data.objects[body_name], 0.6
            rig = body.parent  # Body 2 stands to the side, only to look at
            top = build_top(f'{name}_{body_name}', spec, body, rig, tops, share)
            while triangles(top) > BUDGET:  # the bands and rim add more on some bodies than others
                share *= BUDGET / triangles(top) * 0.97
                bpy.data.objects.remove(top, do_unlink=True)
                top = build_top(f'{name}_{body_name}', spec, body, rig, tops, share)
            made[top.name] = triangles(top)
    return made


def show_only(name):
    for o in bpy.data.collections['soft_tops'].objects:
        visible = o.name.startswith(name + '_')
        o.hide_set(not visible)
        o.hide_render = not visible


def render_views(out_dir, name, views=(('front', 0), ('3q', 40), ('side', 90), ('back', 180)), aim=None, size=2.6):
    """Both bodies wearing `name`, from each side, as <name>_<view>.png."""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'Standard'
    scene.render.resolution_x, scene.render.resolution_y = 700, 520
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.62, 0.7, 1)
    cam = bpy.data.objects.get('TopCam') or bpy.data.objects.new('TopCam', bpy.data.cameras.new('TopCam'))
    sun = bpy.data.objects.get('TopSun') or bpy.data.objects.new('TopSun', bpy.data.lights.new('TopSun', 'SUN'))
    for o in (cam, sun):
        if o.name not in scene.collection.objects:
            scene.collection.objects.link(o)
    sun.data.energy = 3.0
    sun.rotation_euler = (0.8, 0.2, -0.6)
    cam.data.type = 'ORTHO'
    scene.camera = cam
    show_only(name)
    paths = []
    for view, yaw in views:
        target = aim or Vector((BODY2_X / 2, 0, 0.65))
        turn = math.radians(yaw)
        cam.location = target + Vector((math.sin(turn), -math.cos(turn), 0.1)).normalized() * 6
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.ortho_scale = size
        scene.render.filepath = os.path.join(out_dir, f'{name}_{view}.png')
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    return paths


def pose(stride=True):
    """Both bodies mid-stride with their arms down, to see the tops bend (False: back at rest)."""
    for game_id in ('knight', 'barbarian'):
        bones = bpy.data.objects['rig_' + game_id].pose.bones
        for b in bones:
            b.rotation_mode = 'XYZ'
            b.rotation_euler = (0, 0, 0)
        if not stride:
            continue
        for side, s in (('l', 1), ('r', -1)):
            bones['upperarm.' + side].rotation_euler = (-math.radians(68), 0, s * math.radians(15))
            bones['lowerarm.' + side].rotation_euler = (0, 0, s * math.radians(30))
        bones['upperleg.l'].rotation_euler = (math.radians(30), 0, 0)
        bones['upperleg.r'].rotation_euler = (-math.radians(35), 0, 0)
        bones['lowerleg.l'].rotation_euler = (-math.radians(35), 0, 0)
        bones['spine'].rotation_euler = (0, 0, math.radians(12))
    bpy.context.view_layer.update()


def export_all(tmp_dir, only=None):
    """Both fits of each top on Body 1's skeleton, to assets/gear/<file>.glb, Meshopt-compressed."""
    pose(False)
    rig = bpy.data.objects['rig_knight']
    os.makedirs(tmp_dir, exist_ok=True)
    sizes = {}
    for name, spec in TOPS.items():
        if only and name not in only:
            continue
        fits = [bpy.data.objects[f'{name}_{body}'] for body in ('body1', 'body2')]
        for fit in fits:
            fit.data.name = fit.name  # the glb's mesh names, so they read as the fit they are
        second_rig = fits[1].parent
        on_rig(fits[1], rig)  # where Body 1 stands: the skeleton and rest pose are the same
        for layer in bpy.context.scene.view_layers:
            for o in layer.objects:
                o.select_set(False, view_layer=layer)
        for o in [rig] + fits:
            o.hide_set(False)
            o.hide_render = False
            o.select_set(True)
        bpy.context.view_layer.objects.active = rig
        raw = os.path.join(tmp_dir, spec['file'] + '.glb')
        bpy.ops.export_scene.gltf(
            filepath=raw, export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True,
            export_apply=False, export_skins=True, export_animations=False, export_def_bones=False,
            export_materials='EXPORT', export_extras=False)
        on_rig(fits[1], second_rig)
        out = os.path.join(REPO, 'assets', 'gear', spec['file'] + '.glb')
        subprocess.run(['node', os.path.join(REPO, 'tools', 'import-model.mjs'), raw, out],
                       cwd=REPO, check=True, shell=os.name == 'nt')
        sizes[spec['file']] = os.path.getsize(out)
    return sizes
