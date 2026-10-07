# The iron axe, built in Blender through the Blender MCP. Exec after dwarf_build.py (it reuses
# make_material, hexc and the shading constants), then call build_iron_axe().
# Chunky, readable and low-poly: tapered wooden haft with a knob, wrapped leather grip, iron collar,
# a curved bevelled head with a bright cutting edge and two rivets. Colours are vertex colours with
# the same soft top-lit shading as the dwarves, so it sits with them and can't bleed at a distance.
# Origin at the bottom of the haft, 1 unit = 1 m, the blade points along +X before export.
import math
import bpy
import bmesh

AXE_COLOURS = {
    'wood': '#a0703f', 'wood_dark': '#7a5030', 'leather': '#5e3a24', 'leather_light': '#7a4c2e',
    'iron': '#7f8c98', 'iron_dark': '#58626e', 'edge': '#e2e8ee',
}


def _loft(bm, rings, seg=10):
    """Rings of (z, radius) round the Z axis, capped at both ends. Returns the new faces."""
    made, prev, first = [], None, None
    for z, r in rings:
        vs = [bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)]
        if prev:
            for i in range(seg):
                made.append(bm.faces.new((prev[i], prev[(i + 1) % seg], vs[(i + 1) % seg], vs[i])))
        else:
            first = vs
        prev = vs
    made.append(bm.faces.new(first[::-1]))
    made.append(bm.faces.new(prev))
    return made


def build_iron_axe():
    for o in [o for o in bpy.data.objects if o.name == 'iron_axe']:
        bpy.data.objects.remove(o, do_unlink=True)
    for m in [m for m in bpy.data.meshes if m.name.startswith('iron_axe') and m.users == 0]:
        bpy.data.meshes.remove(m)
    col = bpy.data.collections.get('IronAxe') or bpy.data.collections.new('IronAxe')
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)

    bm = bmesh.new()
    part = bm.faces.layers.int.new('part')
    smooth = bm.faces.layers.int.new('smooth')
    names = list(AXE_COLOURS)

    def tag(faces, name, is_smooth):
        for f in faces:
            f[part] = names.index(name)
            f[smooth] = 1 if is_smooth else 0

    # haft: knob at the bottom, gentle taper, slightly fuller under the head
    tag(_loft(bm, [(0, .036), (.022, .046), (.05, .046), (.07, .034), (.45, .029), (.64, .033), (.84, .033), (.86, .028)]), 'wood', True)
    tag(_loft(bm, [(.0, .04), (.006, .047), (.044, .048), (.05, .04)]), 'wood_dark', True)
    # wrapped grip: three slightly offset bands read as a leather wrap
    for i, z in enumerate((.1, .165, .23)):
        tag(_loft(bm, [(z, .038), (z + .006, .042), (z + .058, .042), (z + .064, .038)]), 'leather' if i % 2 == 0 else 'leather_light', True)
    # iron collar holding the head
    tag(_loft(bm, [(.57, .05), (.585, .057), (.775, .057), (.79, .05)]), 'iron_dark', False)

    # head: curved bevelled blade, thick at the eye and thin at the edge
    head_bm = bmesh.new()
    prof = [(-.075, .62), (-.02, .6), (.06, .57), (.2, .5), (.245, .58), (.258, .66), (.245, .74), (.2, .82), (.06, .75), (-.02, .73), (-.075, .71)]
    th = [.046, .05, .05, .013, .011, .011, .011, .013, .05, .05, .046]
    top = [head_bm.verts.new((x, th[i], z)) for i, (x, z) in enumerate(prof)]
    bot = [head_bm.verts.new((x, -th[i], z)) for i, (x, z) in enumerate(prof)]
    head_bm.faces.new(top[::-1]); head_bm.faces.new(bot)
    for i in range(len(prof)):
        j = (i + 1) % len(prof)
        head_bm.faces.new((top[i], top[j], bot[j], bot[i]))
    bmesh.ops.recalc_face_normals(head_bm, faces=head_bm.faces)
    bmesh.ops.bevel(head_bm, geom=list(head_bm.edges), offset=.009, segments=1, affect='EDGES', clamp_overlap=True)
    head_me = bpy.data.meshes.new('iron_axe_head_tmp')
    head_bm.to_mesh(head_me); head_bm.free()
    before = len(bm.faces)
    bm.from_mesh(head_me)
    bpy.data.meshes.remove(head_me)
    bm.faces.ensure_lookup_table()
    head_faces = [bm.faces[i] for i in range(before, len(bm.faces))]
    for f in head_faces:
        tag([f], 'edge' if f.calc_center_median().x > .2 else 'iron', False)
    # rivets on both cheeks
    for side in (1, -1):
        res = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=.016,
                                        matrix=__import__('mathutils').Matrix.Translation((.02, side * .05, .665)))
        faces = {f for v in res['verts'] for f in v.link_faces}
        tag(faces, 'iron_dark', True)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    parts = [f[part] for f in bm.faces]
    smooths = [f[smooth] for f in bm.faces]
    me = bpy.data.meshes.new('iron_axe')
    bm.to_mesh(me); bm.free()

    palette = [hexc(AXE_COLOURS[n]) for n in names]
    colour = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for p, pi, sm in zip(me.polygons, parts, smooths):
        p.use_smooth = bool(sm)
        c = palette[pi]
        for li in p.loop_indices:
            nz = me.vertices[me.loops[li].vertex_index].normal.z if sm else p.normal.z
            shade = SHADE_DOWN + (SHADE_UP - SHADE_DOWN) * (.5 + .5 * nz)
            colour.data[li].color_srgb = (min(1, c[0] * shade), min(1, c[1] * shade), min(1, c[2] * shade), 1)
    me.color_attributes.active_color = colour
    old = bpy.data.materials.get('iron_axe_mat')
    if old:
        bpy.data.materials.remove(old)
    mat = make_material('iron_axe')
    me.materials.append(mat)
    ob = bpy.data.objects.new('iron_axe', me)
    col.objects.link(ob)
    return ob
