# Preview stage for the dwarves: lights, ground, camera, and a render helper.
import bpy, math
from mathutils import Vector


def setup_stage():
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_EEVEE'
    except Exception:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x = 1600
    sc.render.resolution_y = 700
    sc.view_settings.view_transform = 'Standard'
    w = sc.world or bpy.data.worlds.new("World")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.78, 0.84, 0.9, 1)
    bg.inputs[1].default_value = 1.0
    for n in ("preview_ground", "preview_sun", "preview_fill"):
        if n in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    g = bpy.context.active_object; g.name = "preview_ground"
    m = bpy.data.materials.get("preview_ground_mat") or bpy.data.materials.new("preview_ground_mat")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.42, 0.5, 0.3, 1)
    g.data.materials.clear(); g.data.materials.append(m)
    sun = bpy.data.lights.new("preview_sun", 'SUN'); sun.energy = 3.2
    so = bpy.data.objects.new("preview_sun", sun); bpy.context.scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    fill = bpy.data.lights.new("preview_fill", 'SUN'); fill.energy = 1.0
    fo = bpy.data.objects.new("preview_fill", fill); bpy.context.scene.collection.objects.link(fo)
    fo.rotation_euler = (math.radians(70), 0, math.radians(150))
    sc.camera.data.type = 'ORTHO'


def attach_preview_axes(chars, specs):
    """Parents a copy of the iron axe to each character's right hand (preview only)."""
    from mathutils import Matrix
    src = bpy.data.objects["iron_axe"]
    for sp, *_ in specs:
        arm = chars[sp['name']][0]
        n = "preview_axe_" + sp['name']
        if n in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
        ob = bpy.data.objects.new(n, src.data)
        arm.users_collection[0].objects.link(ob)
        hs = sp['hand']
        s = .8  # preview size of the axe next to these characters
        G = sp.get('G', 1.0)
        centre = Vector((-sp['sx'] * G, 0, (sp['wrist_z'] - hs[2] * .75) * G)) + Vector((0, .22 * s, 0))
        R = Matrix(((0, 1, 0), (0, 0, -1), (-1, 0, 0))).to_4x4() @ Matrix.Scale(s, 4)
        ob.matrix_world = arm.matrix_world @ Matrix.Translation(centre) @ R
        pb = arm.pose.bones['hand_R']
        ob.parent = arm; ob.parent_type = 'BONE'; ob.parent_bone = 'hand_R'
        ob.matrix_parent_inverse = (arm.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))).inverted()
        ob.hide_render = False; ob.hide_viewport = False


def shot(path, center, ortho, loc_dir=(0, -10, 1.0), res=(1600, 700)):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    cam = sc.camera
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = ortho
    cam.data.clip_end = 100
    loc = Vector(center) + Vector(loc_dir)
    cam.location = loc
    cam.rotation_euler = (Vector(center) - loc).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
