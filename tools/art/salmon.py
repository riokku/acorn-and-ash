# The salmon of the autumn run (decision 0294; assets/critters/salmon.glb), built in Blender
# through the Blender MCP.
#
#     import sys; sys.path.insert(0, r'<repo>/tools/art')
#     import salmon
#     ob = salmon.build()          # one object, `salmon`
#     salmon.render_views(out_dir) # preview pictures
#
# A sockeye in its spawning colours: a red body with a humped back, an olive-green head with a
# hooked jaw, and a green tail. Faceted and coloured per facet, like the dwarves, with no texture.
# It is 0.7 m long, nose towards -Y (which the game reads as forwards), belly at about z = -0.09,
# with its middle at the origin so the game can turn and tip it about its own centre as it leaps.
# The game moves it by code; there is no skeleton.
import math
import os

import bmesh
import bpy
from mathutils import Vector

import heroic_dwarves as hd

LENGTH = .7
COLOURS = {
    'red': '#cf3a2c', 'red_dark': '#a82a22', 'belly': '#e0705a',
    'green': '#5f7d45', 'green_dark': '#4a6438', 'jaw': '#3f5433',
    'fin': '#8c2a22', 'eye': '#f3ead2', 'pupil': '#1d1a16',
}


def _add(bm, layer, piece, colour, vary=.08, seed=0.0):
    bmesh.ops.recalc_face_normals(piece, faces=piece.faces)
    piece.normal_update()
    made = {}
    for v in piece.verts:
        made[v] = bm.verts.new(v.co)
    for i, f in enumerate(piece.faces):
        nf = bm.faces.new([made[v] for v in f.verts])
        c = colour(f.calc_center_median(), f.normal) if callable(colour) else hd.hexc(colour)
        k = 1 + (hd.rnd(i, seed) - .5) * vary
        for loop in nf.loops:
            loop[layer] = (c[0] * k, c[1] * k, c[2] * k, 1.0)
    piece.free()


def build(collection=None):
    collection = collection or bpy.context.scene.collection
    old = bpy.data.objects.get('salmon')
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    bm = bmesh.new()
    layer = bm.loops.layers.float_color.new('Col')
    red, dark, belly = hd.hexc(COLOURS['red']), hd.hexc(COLOURS['red_dark']), hd.hexc(COLOURS['belly'])
    green, green_dark = hd.hexc(COLOURS['green']), hd.hexc(COLOURS['green_dark'])

    def body_colour(c, n):
        if c.y < -.2:  # the head
            return hd.mix(green, green_dark, hd.smooth(.3, -.5, n.z))
        col = hd.mix(red, dark, hd.smooth(.2, .9, n.z))
        col = hd.mix(col, belly, hd.smooth(-.3, -.9, n.z))
        # Green creeps back into the red just behind the head, and again at the tail.
        return hd.mix(col, green_dark, max(hd.smooth(-.14, -.2, c.y), hd.smooth(.24, .31, c.y)) * .7)

    # The body: loops from the nose to the root of the tail (along, half-width, half-height, lift).
    loops = [(-.35, .008, .012, -.012), (-.315, .03, .04, -.008), (-.25, .05, .068, 0), (-.16, .062, .1, .012),
             (-.04, .064, .112, .018), (.09, .052, .09, .008), (.2, .032, .058, 0), (.27, .016, .034, 0)]
    rings = [hd.ring((0, y, lift), (w, 0, 0), (0, 0, h), 8, 2.4) for y, w, h, lift in loops]
    _add(bm, layer, hd.loft(rings), body_colour, seed=1)

    # The hooked jaw of a spawning male.
    _add(bm, layer, hd.hull([(s * .02, -.33, -.022) for s in (1, -1)] + [(s * .016, -.3, -.05) for s in (1, -1)]
                            + [(0, -.365, -.042), (0, -.372, -.018), (0, -.33, -.058)]), COLOURS['jaw'], seed=2)
    _add(bm, layer, hd.hull([(0, -.355, .0), (0, -.378, -.012), (s := .012, -.33, .012), (-s, -.33, .012),
                             (0, -.34, -.012)]), COLOURS['green_dark'], seed=3)

    # Fins: the tail, the fin on the back, the small one behind it, and one each side below.
    fin = COLOURS['fin']
    _add(bm, layer, hd.hull([(s * .008, .255, t) for s in (1, -1) for t in (.03, -.03)]
                            + [(0, .35, .1), (0, .35, -.1), (0, .31, 0), (s := .006, .33, .06), (-s, .33, -.06)]),
         lambda c, n: hd.mix(hd.hexc(fin), green_dark, hd.smooth(.3, .35, c.y) * .6), seed=4)
    _add(bm, layer, hd.hull([(s * .006, -.07, .118) for s in (1, -1)] + [(s * .005, .05, .118) for s in (1, -1)]
                            + [(0, .03, .19), (0, -.02, .18)]), fin, seed=5)
    _add(bm, layer, hd.hull([(s * .004, .17, .06) for s in (1, -1)] + [(0, .2, .058), (0, .2, .09)]), fin, seed=6)
    for s in (1, -1):
        _add(bm, layer, hd.hull([(s * .05, -.19, -.05), (s * .054, -.14, -.058), (s * .1, -.12, -.1),
                                 (s * .08, -.16, -.1), (s * .05, -.16, -.07)]), fin, seed=7 + s)
    _add(bm, layer, hd.hull([(s * .004, .12, -.08) for s in (1, -1)] + [(s * .004, .2, -.05) for s in (1, -1)]
                            + [(0, .18, -.12)]), fin, seed=9)

    # Eyes.
    for s in (1, -1):
        _add(bm, layer, hd.hull([(s * .044, -.27 + dy, .012 + dz) for dy, dz in ((-.012, 0), (.012, 0), (0, .012), (0, -.012))]
                                + [(s * .05, -.27, .012)]), COLOURS['eye'], vary=0, seed=10)
        _add(bm, layer, hd.hull([(s * .049, -.272 + dy, .012 + dz) for dy, dz in ((-.006, 0), (.006, 0), (0, .006), (0, -.006))]
                                + [(s * .053, -.272, .012)]), COLOURS['pupil'], vary=0, seed=11)

    me = bpy.data.meshes.new('salmon')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    me.color_attributes.active_color = me.color_attributes['Col']
    me.color_attributes.render_color_index = me.color_attributes.find('Col')
    ob = bpy.data.objects.new('salmon', me)
    collection.objects.link(ob)
    me.materials.append(hd.material('salmon_mat', hd.CLOTH))
    return ob


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def render_views(out_dir):
    return hd.render_views(out_dir, 'salmon', views=('side', 'three', 'front'), size=(900, 520),
                           target=(0, 0, .02), dist=2.6)


def export(tmp_dir, repo):
    """Write assets/critters/salmon.glb, Meshopt-compressed."""
    import subprocess
    ob = bpy.data.objects['salmon']
    for layer in bpy.context.scene.view_layers:
        for o in layer.objects:
            o.select_set(False, view_layer=layer)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    os.makedirs(tmp_dir, exist_ok=True)
    raw = os.path.join(tmp_dir, 'salmon.glb')
    bpy.ops.export_scene.gltf(filepath=raw, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_vertex_color='MATERIAL', export_all_vertex_colors=False,
                              export_materials='EXPORT')
    out = os.path.join(repo, 'assets', 'critters', 'salmon.glb')
    subprocess.run(['node', os.path.join(repo, 'tools', 'import-model.mjs'), raw, out, '--quantize'],
                   cwd=repo, check=True, shell=os.name == 'nt')
    return os.path.getsize(out)
