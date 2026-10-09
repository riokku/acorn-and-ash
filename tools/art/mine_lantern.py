# The mine lantern, built in Blender through the Blender MCP (decision 0119, step 3).
# Exec this file, then call build_mine_lantern().
#
# A small iron-and-glass hanging lantern, about 0.36 m tall: a hanging ring, a
# conical cap, a glowing glass chimney held by four iron bars, and a base plate.
# The origin is the hanging point (top of the ring) and the lantern hangs down
# from it, so the game can hook it onto a support post and it swings from there.
# Colours are vertex colours; the glass is drawn bright so it reads as lit, and
# the game adds the real light.
import math

import bmesh
import bpy
from mathutils import Vector

SHADE_DOWN, SHADE_UP = .80, 1.06

COLOURS = {
    'iron': '#4a4642', 'iron_light': '#6a645e', 'brass': '#b08a3e',
    'glow': '#ffd37a', 'flame': '#fff3c4',
}
# parts that are lit from inside and so ignore the top-lit shading
UNSHADED = {'glow', 'flame'}


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
    b.inputs["Roughness"].default_value = 0.8
    return mat


def _basis(direction):
    helper = Vector((0, 0, 1)) if abs(direction.z) < .9 else Vector((1, 0, 0))
    u = direction.cross(helper).normalized()
    v = direction.cross(u).normalized()
    return u, v


def _limb(bm, a, b, ra, rb, seg, part_name, end_name, tag, turn=.5):
    """A prism (cone if the radii differ) from point a to point b, capped at both ends."""
    a, b = Vector(a), Vector(b)
    u, v = _basis((b - a).normalized())
    rings = []
    for p, r in ((a, ra), (b, rb)):
        rings.append([bm.verts.new(p + (u * math.cos(2 * math.pi * (i + turn) / seg)
                                        + v * math.sin(2 * math.pi * (i + turn) / seg)) * r)
                      for i in range(seg)])
    for i in range(seg):
        j = (i + 1) % seg
        tag(bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i])), part_name)
    tag(bm.faces.new(rings[0][::-1]), end_name)
    tag(bm.faces.new(rings[1]), end_name)


def build_mine_lantern():
    for o in [o for o in bpy.data.objects if o.name == 'mine_lantern']:
        bpy.data.objects.remove(o, do_unlink=True)
    for m in [m for m in bpy.data.meshes if m.name.startswith('mine_lantern') and m.users == 0]:
        bpy.data.meshes.remove(m)
    col = bpy.data.collections.get('MineLantern') or bpy.data.collections.new('MineLantern')
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)

    bm = bmesh.new()
    part = bm.faces.layers.int.new('part')
    names = list(COLOURS)

    def tag(face, name):
        face[part] = names.index(name)

    # hanging ring: a short flat loop, two bars and two caps
    for dx in (-.026, .026):
        _limb(bm, (dx, 0, -.002), (dx, 0, -.06), .008, .008, 4, 'iron_light', 'iron_light', tag)
    _limb(bm, (-.026, 0, -.002), (.026, 0, -.002), .008, .008, 4, 'iron_light', 'iron_light', tag)
    # conical cap and its rim
    _limb(bm, (0, 0, -.055), (0, 0, -.135), .03, .118, 8, 'iron', 'iron', tag)
    _limb(bm, (0, 0, -.135), (0, 0, -.155), .118, .118, 8, 'brass', 'brass', tag)
    # glowing glass chimney
    _limb(bm, (0, 0, -.155), (0, 0, -.305), .088, .088, 8, 'glow', 'glow', tag)
    # four iron bars round the glass
    for i in range(4):
        ang = math.pi / 4 + i * math.pi / 2
        x, y = math.cos(ang) * .1, math.sin(ang) * .1
        _limb(bm, (x, y, -.155), (x, y, -.305), .011, .011, 4, 'iron', 'iron', tag)
    # base plate and foot
    _limb(bm, (0, 0, -.305), (0, 0, -.335), .112, .098, 8, 'brass', 'brass', tag)
    _limb(bm, (0, 0, -.335), (0, 0, -.352), .05, .035, 8, 'iron', 'iron', tag)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    parts = [f[part] for f in bm.faces]
    me = bpy.data.meshes.new('mine_lantern')
    bm.to_mesh(me); bm.free()

    palette = [hexc(COLOURS[n]) for n in names]
    colour = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for p, pi in zip(me.polygons, parts):
        p.use_smooth = False
        c = palette[pi]
        shade = 1.0 if names[pi] in UNSHADED else SHADE_DOWN + (SHADE_UP - SHADE_DOWN) * (.5 + .5 * p.normal.z)
        for li in p.loop_indices:
            colour.data[li].color_srgb = (min(1, c[0] * shade), min(1, c[1] * shade), min(1, c[2] * shade), 1)
    me.color_attributes.active_color = colour
    old = bpy.data.materials.get('mine_lantern_mat')
    if old:
        bpy.data.materials.remove(old)
    me.materials.append(make_material('mine_lantern'))
    ob = bpy.data.objects.new('mine_lantern', me)
    col.objects.link(ob)
    return ob
