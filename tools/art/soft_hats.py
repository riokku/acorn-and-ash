# Every helm-slot hat, fitted to the two soft bodies (decision 0283). The old hats were lifted off
# the KayKit Adventurers (decision 0112), whose heads are about two and a half times bigger, and
# the wool cap and the Last Watch helm were sized for those heads too. Run inside Blender through
# the Blender MCP, with REPO set to this repository's folder:
#
#     REPO = r'<repo>'
#     exec(open(REPO + r'\tools\art\soft_hats.py').read())
#     build()                         # both bodies side by side, every hat fitted to them
#     render_views(out_dir)           # front, three-quarter, side and back, one picture per hat
#     export_all(tmp_dir)             # assets/gear/<file>.glb for every hat
#
# The two bodies share one skeleton (decision 0272), so one hat fits both: each is weighted wholly
# to the head bone and exported on that skeleton. Body 2 stands 1.2 m to the side, with a copy of
# each hat, only to look at; she is not exported. Facing -Y, Z up, as the bodies are.
import math
import os
import subprocess

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

REPO = globals().get('REPO') or os.getcwd()
BODY2_X = 1.2

# The middle of a soft head, and of the old Adventurer heads the pack hats were made for.
SOFT_HEAD = Vector((0, 0.018, 1.11))
OLD_HEAD = Vector((0, -0.025, 1.75))
OLD_TO_SOFT = 0.40

# pack hat -> (its parts in plain-bodies.blend, the file it goes to, lift, scale): the lift and the
# scale were found by eye from the pictures, so the eyes show and no hair pokes through.
PACK_HATS = {
    'knight_helmet': (('knight_helmet', 'knight_helmet_visor'), 'knight-helmet', 0.035, 1.06),
    'mage_hat': (('mage_hat',), 'mage-hat', 0.0, 1.0),
    'bear_hat': (('barbarian_bear_hat',), 'barbarian-bear-hat', 0.085, 0.96),
    'rogue_mask': (('rogue_mask',), 'rogue-mask', 0.07, 1.0),
}
# Where the Last Watch helm's rim sits on a soft head, and its size: the brow clears the eyes.
LAST_WATCH = (Vector((0, 0.04, 1.165)), 0.82)
WOOL = '767b65'
WOOL_CUFF = '686d58'


def linear(hex_colour):
    return tuple((int(hex_colour[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)) + (1.0,)


def collection(name):
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    return col


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def import_bodies():
    """Body 1 and Body 2 from the game's own files, at rest, each with the beard it starts with."""
    rigs = {}
    for game_id, x in (('knight', 0.0), ('barbarian', BODY2_X)):
        new = import_glb(os.path.join(REPO, 'assets', 'characters', game_id + '.glb'))
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


def rest_copy(source, name, into):
    """A plain mesh of `source` as it stands at rest, in world space."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(source.evaluated_get(depsgraph))
    mesh.transform(source.matrix_world)
    ob = bpy.data.objects.new(name, mesh)
    into.objects.link(ob)
    return ob


def join(parts, name):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    parts[0].name = parts[0].data.name = name
    return parts[0]


def fit_pack_hats(into):
    """The pack's hats, shrunk from the Adventurers' heads to the soft ones and moved into place."""
    with bpy.data.libraries.load(os.path.join(REPO, 'assets', 'characters', 'plain-bodies.blend')) as (src, dst):
        dst.objects = sorted({part for parts, *_ in PACK_HATS.values() for part in parts})
    staging = collection('pack_hats')
    originals = {}
    for o in dst.objects:
        originals[o.name] = o
        o.name = 'pack_' + o.name  # so the fitted hats can take the plain names
        staging.objects.link(o)
        if o.parent is not None and o.parent.name not in staging.objects:
            staging.objects.link(o.parent)
    bpy.context.view_layer.update()
    for parent in {o.parent for o in dst.objects if o.parent}:
        for pb in parent.pose.bones:
            pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    to_soft = Matrix.Translation(SOFT_HEAD) @ Matrix.Scale(OLD_TO_SOFT, 4) @ Matrix.Translation(-OLD_HEAD)
    hats = {}
    for name, (parts, _file, lift, scale) in PACK_HATS.items():
        pieces = [rest_copy(originals[part], name + '_' + part, into) for part in parts]
        hat = join(pieces, name)
        hat.vertex_groups.clear()
        settle = Matrix.Translation(SOFT_HEAD + Vector((0, 0, lift))) @ Matrix.Scale(scale, 4) @ Matrix.Translation(-SOFT_HEAD)
        hat.data.transform(settle @ to_soft)
        hats[name] = hat
    bpy.context.view_layer.layer_collection.children[staging.name].exclude = True
    return hats


def head_surface(rigs):
    """Rays against both heads (with Body 2's hair), as if they stood in the same place."""
    trees = []
    for game_id, names in (('knight', ('body1',)), ('barbarian', ('body2', 'body2_Hair'))):
        offset = rigs[game_id].location.x
        verts, polys = [], []
        for n in names:
            o = bpy.data.objects[n]
            base = len(verts)
            verts += [(o.matrix_world @ v.co) - Vector((offset, 0, 0)) for v in o.data.vertices]
            polys += [[base + i for i in p.vertices] for p in o.data.polygons]
        trees.append(BVHTree.FromPolygons(verts, polys))

    def reach(centre, direction):
        far = 0.0
        for tree in trees:
            hit = tree.ray_cast(centre + direction, -direction, 1.0)[0]
            if hit is not None:
                far = max(far, (hit - centre).length)
        return far
    return reach


def plain_material(name, hex_colour, roughness=0.95):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = linear(hex_colour)
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def build_wool_cap(rigs, into, segments=24):
    """A knitted cap: a crown laid 2 cm over whichever head reaches further, leaning back so it
    comes lower behind, and a ribbed, turned-up cuff round its rim."""
    reach = head_surface(rigs)
    centre = Vector((0, 0.045, 1.10))
    lean = Matrix.Rotation(-math.radians(14), 3, 'X')
    bm = bmesh.new()
    rings = []
    for polar in (0, 10, 20, 30, 40, 50, 58, 64):
        ring = []
        for k in range(1 if polar == 0 else segments):
            around, down = 2 * math.pi * k / segments, math.radians(polar)
            d = lean @ Vector((math.sin(down) * math.cos(around), math.sin(down) * math.sin(around), math.cos(down)))
            ring.append(bm.verts.new(centre + d * (reach(centre, d) + 0.02 + 0.006 * math.sin(down * 2))))
        rings.append(ring)
    for k in range(segments):
        bm.faces.new((rings[0][0], rings[1][k], rings[1][(k + 1) % segments]))
    for a, b in zip(rings[1:], rings[2:]):
        for k in range(segments):
            bm.faces.new((a[k], b[k], b[(k + 1) % segments], a[(k + 1) % segments]))
    rim = [v.co.copy() for v in rings[-1]]
    cuff = bmesh.new()

    def round_rim(out, down):
        verts = []
        for k, p in enumerate(rim):
            flat = p - centre
            flat.z = 0
            flat.normalize()
            verts.append(cuff.verts.new(p + flat * (out + (0.004 if k % 2 == 0 else 0.0)) - Vector((0, 0, down))))
        return verts
    edges = (round_rim(-0.004, -0.012), round_rim(0.018, -0.012), round_rim(0.016, 0.038), round_rim(-0.006, 0.038))
    for a, b in zip(edges, edges[1:]):
        for k in range(segments):
            cuff.faces.new((a[k], a[(k + 1) % segments], b[(k + 1) % segments], b[k]))
    pieces = []
    for b, name, colour in ((bm, 'wool_cap_crown', WOOL), (cuff, 'wool_cap_cuff', WOOL_CUFF)):
        mesh = bpy.data.meshes.new(name)
        b.to_mesh(mesh)
        b.free()
        for p in mesh.polygons:
            p.use_smooth = True
        mesh.materials.append(plain_material(name.replace('wool_cap_', 'wool_') + '_mat', colour))
        ob = bpy.data.objects.new(name, mesh)
        into.objects.link(ob)
        pieces.append(ob)
    return join(pieces, 'wool_cap')


def fit_last_watch(into):
    """The Last Watch helm (tools/art/last_watch_helm.py), set on a soft head as one mesh."""
    new = import_glb(os.path.join(REPO, 'assets', 'gear', 'last-watch-helm.glb'))
    rim, scale = LAST_WATCH
    place = Matrix.Translation(rim) @ Matrix.Scale(scale, 4)
    pieces = []
    for o in new:
        for c in o.users_collection:
            c.objects.unlink(o)
        into.objects.link(o)
        if o.type == 'MESH':
            o.data = o.data.copy()
            o.data.transform(place @ o.matrix_world)
            o.parent = None
            o.matrix_world = Matrix.Identity(4)
            pieces.append(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    return join(pieces, 'last_watch_helm')


def on_head(hat, rig):
    """Weighted wholly to the head bone of `rig`, so the hat turns and nods with the head."""
    hat.vertex_groups.clear()
    hat.vertex_groups.new(name='head').add(range(len(hat.data.vertices)), 1.0, 'REPLACE')
    hat.parent = rig
    hat.matrix_parent_inverse = rig.matrix_world.inverted()
    mod = hat.modifiers.get('Armature') or hat.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig


def build():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    rigs = import_bodies()
    hats_col = collection('soft_hats')
    hats = fit_pack_hats(hats_col)
    hats['wool_cap'] = build_wool_cap(rigs, hats_col)
    hats['last_watch_helm'] = fit_last_watch(hats_col)
    look = collection('body2_hats')
    for name, hat in hats.items():
        on_head(hat, rigs['knight'])
        twin = bpy.data.objects.new(name + '_body2', hat.data)
        twin.location.x = BODY2_X
        look.objects.link(twin)
    return {name: len(hat.data.polygons) for name, hat in hats.items()}


FILES = {**{name: f for name, (_p, f, *_r) in PACK_HATS.items()}, 'wool_cap': 'wool-cap', 'last_watch_helm': 'last-watch-helm-worn'}


def show_only(name):
    for col in ('soft_hats', 'body2_hats'):
        for o in bpy.data.collections[col].objects:
            visible = o.name in (name, name + '_body2')
            o.hide_set(not visible)
            o.hide_render = not visible


def render_views(out_dir, hats=None):
    """Front, three-quarter, side and back of both bodies wearing each hat, as <hat>_<view>.png."""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'Standard'
    scene.render.resolution_x, scene.render.resolution_y = 600, 400
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.62, 0.7, 1)
    cam = bpy.data.objects.get('HatCam') or bpy.data.objects.new('HatCam', bpy.data.cameras.new('HatCam'))
    sun = bpy.data.objects.get('HatSun') or bpy.data.objects.new('HatSun', bpy.data.lights.new('HatSun', 'SUN'))
    for o in (cam, sun):
        if o.name not in scene.collection.objects:
            scene.collection.objects.link(o)
    sun.data.energy = 3.0
    sun.rotation_euler = (0.8, 0.2, -0.6)
    cam.data.type = 'ORTHO'
    scene.camera = cam
    centre = Vector((BODY2_X / 2, 0, 1.12))
    for name in hats or FILES:
        show_only(name)
        for view, yaw, size in (('front', 0, 1.7), ('3q', 40, 1.9), ('side', 90, 1.7), ('back', 180, 1.7)):
            aim = centre if view != 'side' else Vector((BODY2_X, 0, 1.12))
            turn = math.radians(yaw)
            cam.location = aim + Vector((math.sin(turn), -math.cos(turn), 0.15)).normalized() * 5
            cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()
            cam.data.ortho_scale = size if view != 'side' else 1.0
            scene.render.filepath = os.path.join(out_dir, f'{name}_{view}.png')
            bpy.ops.render.render(write_still=True)


def export_all(tmp_dir):
    """Each hat on its own with the skeleton, to assets/gear/<file>.glb, Meshopt-compressed."""
    rig = bpy.data.objects['rig_knight']
    os.makedirs(tmp_dir, exist_ok=True)
    sizes = {}
    for name, file in FILES.items():
        hat = bpy.data.objects[name]
        for layer in bpy.context.scene.view_layers:
            for o in layer.objects:
                o.select_set(False, view_layer=layer)
        for o in (rig, hat):
            o.hide_set(False)
            o.hide_render = False
            o.select_set(True)
        bpy.context.view_layer.objects.active = rig
        raw = os.path.join(tmp_dir, file + '.glb')
        bpy.ops.export_scene.gltf(
            filepath=raw, export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True,
            export_apply=False, export_skins=True, export_animations=False, export_def_bones=False,
            export_materials='EXPORT', export_extras=False)
        out = os.path.join(REPO, 'assets', 'gear', file + '.glb')
        subprocess.run(['node', os.path.join(REPO, 'tools', 'import-model.mjs'), raw, out],
                       cwd=REPO, check=True, shell=os.name == 'nt')
        sizes[file] = os.path.getsize(out)
    return sizes
