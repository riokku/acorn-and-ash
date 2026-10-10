"""
Builds the layered earth texture shown on the walls of dug tunnels and pits
(decision 0114, step 5; assets/textures/dug-earth-layers.png).

Run it inside Blender (through the Blender MCP). It builds a shader that
paints, on a strip 4 m wide and 6 m deep: dark topsoil (0-0.5 m), brown earth
with roots and embedded stones (0.5-3 m), then grey stone with cracks (3 m and
deeper), getting darker with depth. The horizontal direction is wrapped round a
circle so the strip tiles without a seam. It then renders the strip to a
256 x 384 PNG (64 pixels per metre).

The game maps depth below the surface straight onto the strip's height, and
repeats it sideways every 4 m (apps/client/src/scene/digging.ts).
"""

import math
import bpy

OUT_PNG = r"assets/textures/dug-earth-layers.png"  # relative to the repo root
W, H = 256, 384

mat = bpy.data.materials.new("dug_earth_layers")
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
N, L = nt.nodes, nt.links


def node(kind, **kw):
    n = N.new(kind)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def math_(op, a=None, b=None, clamp=False):
    n = node("ShaderNodeMath")
    n.operation, n.use_clamp = op, clamp
    for i, x in enumerate((a, b)):
        if x is None:
            continue
        if isinstance(x, (int, float)):
            n.inputs[i].default_value = x
        else:
            L.new(x, n.inputs[i])
    return n.outputs[0]


def mix(a, b, t, blend="MIX"):
    m = node("ShaderNodeMix")
    m.data_type, m.blend_type = "RGBA", blend
    if isinstance(t, (int, float)):
        m.inputs["Factor"].default_value = t
    else:
        L.new(t, m.inputs["Factor"])
    for name, x in (("A", a), ("B", b)):
        if isinstance(x, tuple):
            m.inputs[name].default_value = x
        else:
            L.new(x, m.inputs[name])
    return m.outputs["Result"]


def mapr(x, lo, hi):
    return math_("DIVIDE", math_("SUBTRACT", x, lo), hi - lo, clamp=True)


def gray(x):
    c = node("ShaderNodeCombineColor")
    for i in range(3):
        L.new(x, c.inputs[i])
    return c.outputs[0]


uv = node("ShaderNodeTexCoord").outputs["UV"]
sep = node("ShaderNodeSeparateXYZ")
L.new(uv, sep.inputs[0])
u, v = sep.outputs[0], sep.outputs[1]
depth = math_("MULTIPLY", math_("SUBTRACT", 1.0, v), 6.0)  # metres below the surface
ang = math_("MULTIPLY", u, 2 * math.pi)
R = 4.0 / (2 * math.pi)
comb = node("ShaderNodeCombineXYZ")
L.new(math_("MULTIPLY", math_("COSINE", ang), R), comb.inputs[0])
L.new(math_("MULTIPLY", math_("SINE", ang), R), comb.inputs[1])
L.new(depth, comb.inputs[2])
P = comb.outputs[0]


def noise(scale, detail=3, rough=0.55, vec=None):
    n = node("ShaderNodeTexNoise")
    n.noise_dimensions = "3D"
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    L.new(vec or P, n.inputs["Vector"])
    return n.outputs["Fac"]


# Wobbly layer boundaries.
d2 = math_("ADD", depth, math_("MULTIPLY", math_("SUBTRACT", noise(1.4, 2), 0.5), 0.8))
topsoil = (0.045, 0.032, 0.018, 1)
earth = (0.15, 0.090, 0.048, 1)
earth2 = (0.11, 0.066, 0.036, 1)
stone = (0.14, 0.135, 0.13, 1)
col = mix(topsoil, earth, mapr(d2, 0.45, 0.75))
col = mix(col, earth2, mapr(d2, 1.2, 3.0))
col = mix(col, stone, mapr(d2, 2.9, 3.2))

# Mottling.
mr = node("ShaderNodeMapRange")
mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = 0.3, 0.7
mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = 0.7, 1.25
L.new(noise(6, 4), mr.inputs["Value"])
col = mix(col, gray(mr.outputs[0]), 0.7, "MULTIPLY")

# Embedded stones: warm grey with a dark rim, in the earth only.
vor = node("ShaderNodeTexVoronoi")
vor.voronoi_dimensions = "3D"
vor.inputs["Scale"].default_value = 1.7
vor.inputs["Randomness"].default_value = 1.0
L.new(P, vor.inputs["Vector"])
cr = node("ShaderNodeSeparateColor")
L.new(vor.outputs["Color"], cr.inputs[0])
is_stone = math_("GREATER_THAN", cr.outputs[0], 0.4)
rad = math_("ADD", 0.17, math_("MULTIPLY", cr.outputs[2], 0.16))
inside = math_("LESS_THAN", vor.outputs["Distance"], rad)
stone_mask = math_("MULTIPLY", math_("MULTIPLY", is_stone, inside), math_("SUBTRACT", 1.0, mapr(d2, 2.5, 3.1)))
fill = mix((0.30, 0.27, 0.23, 1), (0.20, 0.18, 0.15, 1), cr.outputs[1])
rim = math_("GREATER_THAN", vor.outputs["Distance"], math_("SUBTRACT", rad, 0.045))
col = mix(col, mix(fill, (0.05, 0.04, 0.035, 1), rim), stone_mask)

# Cracks between blocks of deep stone.
vor2 = node("ShaderNodeTexVoronoi")
vor2.feature = "DISTANCE_TO_EDGE"
vor2.inputs["Scale"].default_value = 1.5
L.new(P, vor2.inputs["Vector"])
seam = math_("MULTIPLY", math_("LESS_THAN", vor2.outputs["Distance"], 0.035), mapr(d2, 3.1, 3.5))
col = mix(col, (0.04, 0.04, 0.045, 1), math_("MULTIPLY", seam, 0.7))

# Roots: thin meandering lines, stretched downwards, in the top layers only.
mp = node("ShaderNodeMapping")
mp.inputs["Scale"].default_value = (1.0, 1.0, 0.35)
L.new(P, mp.inputs["Vector"])
rn = noise(1.3, 1, 0.5, mp.outputs[0])
line = math_("LESS_THAN", math_("ABSOLUTE", math_("SUBTRACT", rn, 0.5)), 0.016)
root_zone = math_("MULTIPLY", mapr(d2, 0.5, 0.9), math_("SUBTRACT", 1.0, mapr(depth, 1.8, 2.8)))
col = mix(col, (0.27, 0.17, 0.075, 1), math_("MULTIPLY", math_("MULTIPLY", line, root_zone), 0.95))

# Darker with depth: full brightness at the top, 60% at 6 m.
dark = math_("SUBTRACT", 1.0, math_("MULTIPLY", math_("DIVIDE", depth, 6.0, clamp=True), 0.4))
final = mix(col, gray(dark), 1.0, "MULTIPLY")
em = node("ShaderNodeEmission")
L.new(final, em.inputs["Color"])
out = node("ShaderNodeOutputMaterial")
L.new(em.outputs[0], out.inputs["Surface"])

# A 4 m x 6 m plane, seen straight on by an orthographic camera.
bpy.ops.mesh.primitive_plane_add(size=1)
plane = bpy.context.active_object
plane.name = "dug_earth_layers_plane"
plane.scale = (4, 6, 1)
plane.rotation_euler = (math.pi / 2, 0, 0)
bpy.ops.object.transform_apply(scale=True, rotation=True)
plane.data.materials.append(mat)
cam_data = bpy.data.cameras.new("cam")
cam_data.type, cam_data.ortho_scale, cam_data.sensor_fit = "ORTHO", 6, "VERTICAL"
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.collection.objects.link(cam)
cam.location, cam.rotation_euler = (0, -5, 0), (math.pi / 2, 0, 0)
scene = bpy.context.scene
scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.engine = "BLENDER_EEVEE"
scene.render.filepath = OUT_PNG  # set to an absolute path before running
bpy.ops.render.render(write_still=True)
