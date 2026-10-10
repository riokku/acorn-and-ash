# The mine support, built in Blender through the Blender MCP (decision 0119).
# Exec this file, then call build_mine_support().
#
# A rough-hewn timber frame: two posts standing on flat sills, a cap beam that
# overhangs them, and two corner braces, with a few iron nails. It fills one
# support cell: 1 m along the tunnel (X), 2 m across (game Z) and 2 m tall.
#
# Authored in Blender (Z up) with the across direction running along -Y, so the
# glTF exporter (Y up) writes it as game X 0..1, Y 0..2, Z 0..2 with the origin
# at the cell's low corner. Colours are vertex colours with a soft top-lit
# shading, like the other Blender-made pieces (no texture to blur at distance).
import math

import bmesh
import bpy
from mathutils import Vector

SHADE_DOWN, SHADE_UP = .80, 1.06

COLOURS = {
    'wood': '#a4723f', 'wood_dark': '#7d5630', 'wood_end': '#c79a63',
    'sill': '#6f5a44', 'iron': '#58626e',
}

WIDTH = 2.0      # across the tunnel, metres
ALONG = 1.0      # along the tunnel
HEIGHT = 2.0
POST_R = .1
BEAM = .21       # beam is square, this much each way


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def make_material(name):
    """One soft, matte material that takes its colour from the mesh's vertex colours."""
    mat = bpy.data.materials.new(name + "_mat")
    mat.use_nodes = True
    nt = mat.node_tree
    vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Col"
    b = nt.nodes["Principled BSDF"]
    nt.links.new(vc.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.9
    return mat


def _jitter(i, amount):
    """A repeatable wobble, so hewn timber is never perfectly true."""
    v = math.sin(i * 12.9898 + 78.233) * 43758.5453
    return (v - math.floor(v) - .5) * 2 * amount


def _basis(direction):
    helper = Vector((0, 0, 1)) if abs(direction.z) < .9 else Vector((1, 0, 0))
    u = direction.cross(helper).normalized()
    v = direction.cross(u).normalized()
    return u, v


def _limb(bm, a, b, ra, rb, seg, rough, seed, side_part, end_part, tag):
    """A prism from point a to point b, radius ra to rb, capped at both ends."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u, v = _basis(d)
    rings = []
    for k, (p, r) in enumerate(((a, ra), (b, rb))):
        ring = []
        for i in range(seg):
            ang = 2 * math.pi * (i + .5) / seg
            wob = 1 + _jitter(seed * 31 + k * 7 + i, rough)
            ring.append(bm.verts.new(p + (u * math.cos(ang) + v * math.sin(ang)) * r * wob))
        rings.append(ring)
    made = []
    for i in range(seg):
        j = (i + 1) % seg
        made.append((bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i])), side_part))
    made.append((bm.faces.new(rings[0][::-1]), end_part))
    made.append((bm.faces.new(rings[1]), end_part))
    for f, part in made:
        tag(f, part)


def build_mine_support():
    for o in [o for o in bpy.data.objects if o.name == 'mine_support']:
        bpy.data.objects.remove(o, do_unlink=True)
    for m in [m for m in bpy.data.meshes if m.name.startswith('mine_support') and m.users == 0]:
        bpy.data.meshes.remove(m)
    col = bpy.data.collections.get('MineSupport') or bpy.data.collections.new('MineSupport')
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)

    bm = bmesh.new()
    part = bm.faces.layers.int.new('part')
    names = list(COLOURS)

    def tag(face, name):
        face[part] = names.index(name)

    mid = ALONG / 2
    post_y = (-.14, -(WIDTH - .14))
    beam_z = HEIGHT - BEAM / 2
    post_top = HEIGHT - BEAM

    # flat sills under the posts so they do not sink into the floor
    for n, y in enumerate(post_y):
        _limb(bm, (mid, y, .0), (mid, y, .07), .21, .21, 4, .02, 1 + n, 'sill', 'sill', tag)
    # posts: a little thicker at the foot, hewn eight-sided
    for n, y in enumerate(post_y):
        _limb(bm, (mid, y, .07), (mid, y, post_top), POST_R * 1.08, POST_R * .94, 8, .05, 10 + n, 'wood', 'wood_end', tag)
    # cap beam across the top, overhanging both posts
    _limb(bm, (mid, .06, beam_z), (mid, -(WIDTH + .06), beam_z), BEAM * .6, BEAM * .6, 4, .03, 20, 'wood', 'wood_end', tag)
    # corner braces from each post up to the beam
    for n, y in enumerate(post_y):
        toward = -1 if y > -1 else 1
        foot = (mid, y, post_top - .5)
        head = (mid, y + toward * .5, post_top)
        _limb(bm, foot, head, .045, .045, 4, .04, 30 + n, 'wood', 'wood_end', tag)

    # iron nails where the braces and the beam meet the posts
    for y in post_y:
        for dx in (-.05, .05):
            res = bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=.022,
                                            matrix=__import__('mathutils').Matrix.Translation((mid + dx, y, post_top - .02)))
            for f in {f for v in res['verts'] for f in v.link_faces}:
                tag(f, 'iron')

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    parts = [f[part] for f in bm.faces]
    me = bpy.data.meshes.new('mine_support')
    bm.to_mesh(me); bm.free()

    palette = [hexc(COLOURS[n]) for n in names]
    colour = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for p, pi in zip(me.polygons, parts):
        p.use_smooth = False
        c = palette[pi]
        for li in p.loop_indices:
            shade = SHADE_DOWN + (SHADE_UP - SHADE_DOWN) * (.5 + .5 * p.normal.z)
            colour.data[li].color_srgb = (min(1, c[0] * shade), min(1, c[1] * shade), min(1, c[2] * shade), 1)
    me.color_attributes.active_color = colour
    old = bpy.data.materials.get('mine_support_mat')
    if old:
        bpy.data.materials.remove(old)
    me.materials.append(make_material('mine_support'))
    ob = bpy.data.objects.new('mine_support', me)
    col.objects.link(ob)
    return ob
