# The great snow-capped volcano on the horizon, built in Blender through the
# Blender MCP (decision 0286; assets/terrain/ash-peak.glb).
# Exec this file, then call build_ash_peak().
#
# It is scenery far beyond the edge of the world, so it is modelled at 1:100:
# 18 m across and about 6.5 m tall here, drawn 100 times larger in the game
# (apps/client/src/scene/skyline.ts). The origin is the middle of its base.
#
# The shape is a broad stratovolcano in the manner of the Cascades: long
# concave skirts, a rounded summit with a shallow crater, a sharp shoulder peak
# on one flank, and rock ridges ("cleavers") running down between glaciers.
# Colours are flat per-face vertex colours: dark forest at the foot, bare rock
# above the tree line, and snow that reaches lower in the gullies than on the
# ridges. The game lights it itself from the face normals, so nothing is shaded
# in here.
import math

import bmesh
import bpy

RADIUS = 9.0
HEIGHT = 6.4
SEGMENTS = 44
# Ring radii as a share of RADIUS: packed near the summit, where the detail is.
RINGS = [.022, .05, .085, .125, .17, .22, .28, .35, .43, .52, .62, .73, .85, 1.0]

COLOURS = {
    'snow': '#f3f6fa', 'snow_shade': '#dbe5f0', 'ice': '#c3d6e8',
    'rock': '#6b7079', 'rock_dark': '#555b66', 'scree': '#7d8087',
    'forest': '#2e4a44', 'forest_dark': '#263f3d', 'meadow': '#4a6350',
}


def hexc(h):
    h = h.lstrip('#')
    # Vertex colours are stored linear, as glTF expects.
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


def _hash(a, b=0.0):
    """A repeatable number from 0 to 1."""
    v = math.sin(a * 12.9898 + b * 78.233 + 4.17) * 43758.5453
    return v - math.floor(v)


def _ridges(theta):
    """Where the rock ridges run: about +1 on a ridge crest, -1 in a glacier gully."""
    return (
        .46 * math.sin(5 * theta + 1.3)
        + .30 * math.sin(8 * theta + 4.1)
        + .24 * math.sin(13 * theta + 2.2)
    )


def _profile(t):
    """Height of the plain cone, 1 at the summit to 0 at the foot, for t = radius / RADIUS."""
    # Broad shoulders under a wide summit, then long concave skirts.
    cone = .55 * (1 - t) ** 1.4 + .45 * math.exp(-((t / .45) ** 2))
    # Round the very top into a dome rather than a spike.
    dome = 1 - 1.1 * t * t
    blend = max(0.0, min(1.0, (t - .04) / .1))
    blend = blend * blend * (3 - 2 * blend)
    return dome * (1 - blend) + cone * blend


def _height(t, theta, ring, seg):
    h = _profile(t) * HEIGHT
    # Ridges and gullies, strongest part-way down the flanks.
    flank = math.exp(-((t - .34) / .22) ** 2)
    h *= 1 + .17 * _ridges(theta) * flank
    # The shoulder peak: a sharp horn standing off one flank.
    away = math.atan2(math.sin(theta - 1.05), math.cos(theta - 1.05))
    h += .95 * math.exp(-(away / .16) ** 2) * math.exp(-((t - .3) / .05) ** 2)
    # A second, lower summit bump, so the top is not one clean dome.
    away = math.atan2(math.sin(theta - 3.6), math.cos(theta - 3.6))
    h += .42 * math.exp(-(away / .5) ** 2) * math.exp(-((t - .11) / .06) ** 2)
    # A roughness no two facets share, fading to nothing at the foot.
    h += (_hash(ring * 3.1, seg * 1.7) - .5) * .24 * (1 - t) * max(0.0, min(1.0, (t - .05) / .12))
    return max(0.0, h)


def _colour_for(face, centre_t, theta):
    z = face.calc_center_median().z
    rough = _hash(face.index * .731, 9.0)
    ridge = _ridges(theta)
    snow_line = HEIGHT * (.40 + .13 * ridge + (rough - .5) * .05)
    tree_line = HEIGHT * (.2 + .04 * math.sin(3 * theta + .6) + (rough - .5) * .04)
    steep = face.normal.z < .42
    if z > snow_line:
        if steep and z < HEIGHT * .85 and rough > .35:
            return hexc(COLOURS['rock_dark'] if rough > .7 else COLOURS['rock'])
        if ridge < -.35 and z < HEIGHT * .6:
            return hexc(COLOURS['ice'] if rough > .5 else COLOURS['snow_shade'])
        return hexc(COLOURS['snow'] if rough > .3 else COLOURS['snow_shade'])
    if z > tree_line:
        if rough > .82:
            return hexc(COLOURS['snow_shade'])
        return hexc((COLOURS['rock'], COLOURS['rock_dark'], COLOURS['scree'])[int(rough * 2.99)])
    if z > tree_line - HEIGHT * .045 and rough > .5:
        return hexc(COLOURS['meadow'])
    return hexc(COLOURS['forest'] if rough > .45 else COLOURS['forest_dark'])


def make_material(name):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Roughness"].default_value = 0.9
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return mat


def build_ash_peak(collection=None):
    collection = collection or bpy.context.scene.collection
    old = bpy.data.objects.get('ash_peak')
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)

    bm = bmesh.new()
    layer = bm.loops.layers.float_color.new("Col")  # float colours are stored linear
    top = bm.verts.new((0, 0, _height(0, 0, 0, 0) - .07))  # a shallow crater
    rings = []
    for ring, t in enumerate(RINGS):
        row = []
        for seg in range(SEGMENTS):
            # Every other ring is turned half a step, so the facets are not in neat columns.
            theta = (seg + (.5 if ring % 2 else 0)) / SEGMENTS * math.tau
            wobble = 1 + (_hash(seg * 2.3, ring * 5.9) - .5) * .05
            r = t * RADIUS * wobble
            z = 0.0 if ring == len(RINGS) - 1 else _height(t, theta, ring, seg)
            row.append(bm.verts.new((r * math.cos(theta), r * math.sin(theta), z)))
        rings.append(row)

    meta = {}
    for seg in range(SEGMENTS):
        f = bm.faces.new((top, rings[0][seg], rings[0][(seg + 1) % SEGMENTS]))
        meta[f] = (RINGS[0] / 2, (seg + .5) / SEGMENTS * math.tau)
    for ring in range(len(RINGS) - 1):
        inner, outer = rings[ring], rings[ring + 1]
        t = (RINGS[ring] + RINGS[ring + 1]) / 2
        for seg in range(SEGMENTS):
            nxt = (seg + 1) % SEGMENTS
            theta = (seg + .5) / SEGMENTS * math.tau
            # Triangles, split the way the half-step turn of each ring asks for.
            if ring % 2 == 0:
                tris = ((inner[seg], outer[seg], inner[nxt]), (inner[nxt], outer[seg], outer[nxt]))
            else:
                tris = ((inner[seg], outer[nxt], inner[nxt]), (inner[seg], outer[seg], outer[nxt]))
            for tri in tris:
                f = bm.faces.new(tri)
                meta[f] = (t, theta)

    bm.normal_update()
    bm.faces.index_update()
    for f in bm.faces:
        t, theta = meta[f]
        c = _colour_for(f, t, theta)
        for loop in f.loops:
            loop[layer] = (c[0], c[1], c[2], 1.0)

    mesh = bpy.data.meshes.new('ash_peak')
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = False
    mesh.color_attributes.active_color = mesh.color_attributes['Col']
    mesh.color_attributes.render_color_index = mesh.color_attributes.find('Col')
    ob = bpy.data.objects.new('ash_peak', mesh)
    collection.objects.link(ob)
    ob.data.materials.append(make_material('ash_peak_mat'))
    return ob


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)
