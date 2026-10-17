"""Blender-authored curling fire shared by torches, hearths and forest fires.
Run: blender -b --python tools/art/flame.py -- /tmp/acorn-flame.gltf
Then: node tools/import-model.mjs /tmp/acorn-flame.gltf assets/buildables/flame.glb
"""
import math
import os
import sys
import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start, scene.frame_end = 0, 180


def layer(name, count, radius, height, color, opacity):
    verts, faces, metadata = [], [], []
    sides, rings = 8, 8
    for tongue in range(count):
        angle = tongue * 2.399
        spread = 0 if tongue == 0 else radius * 0.7
        origin = Vector((math.cos(angle) * spread, math.sin(angle) * spread, 0.02))
        tall = height * (1 if tongue == 0 else 0.68 + 0.14 * math.sin(tongue * 2.1))
        width = radius * (0.75 if tongue == 0 else 0.5)
        start = len(verts)
        for ring in range(rings):
            t = ring / (rings - 1)
            profile = (0.62 + 1.5 * t) * (1 - t) ** 1.25 + 0.008
            bend = Vector((math.sin(angle + t * 2) * t*t * radius * 0.5,
                           math.cos(angle + t * 3) * t*t * radius * 0.5, tall * t))
            for side in range(sides):
                a = side / sides * math.tau
                point = origin + bend + Vector((math.cos(a)*width*profile, math.sin(a)*width*profile, 0))
                verts.append(point)
                metadata.append((t, angle, tall))
        for ring in range(rings - 1):
            for side in range(sides):
                a = start + ring*sides + side
                b = start + ring*sides + (side+1)%sides
                faces.append((a,b,b+sides,a+sides))
        faces.append(tuple(start + side for side in reversed(range(sides))))
        faces.append(tuple(start + (rings-1)*sides + side for side in range(sides)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Emission Color'].default_value = (*color, 1)
    shader.inputs['Emission Strength'].default_value = 1.6 if opacity == 1 else 1.1
    shader.inputs['Roughness'].default_value = 1
    shader.inputs['Alpha'].default_value = opacity
    if opacity < 1:
        mat.surface_render_method = 'BLENDED'
    mesh.materials.append(mat)
    ob.shape_key_add(name='Basis')
    for wave in range(3):
        key = ob.shape_key_add(name=['Curl', 'Rise', 'Flutter'][wave])
        for index, (t, angle, tall) in enumerate(metadata):
            # The fuel contact stays fixed; only the upper tongue rolls in the draft.
            weight = t*t
            phase = angle + wave*2.1 + t*2.6
            key.data[index].co += Vector((math.sin(phase)*radius*0.7*weight,
                                         math.cos(phase*1.3)*radius*0.55*weight,
                                         math.sin(angle + wave)*tall*0.24*weight))
        for frame in range(0,181,2):
            time = frame/180
            key.value = 0.5 + 0.5*math.sin(time*math.tau*([5, 7, 11][wave]) + wave*2.1)
            key.keyframe_insert(data_path='value',frame=frame)
    for curve in mesh.shape_keys.animation_data.action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = 'BEZIER'
    return ob

layer('FlameOuter', 5, 0.17, 0.5, (1, 0.12, 0.008), 0.68)
layer('FlameInner', 3, 0.085, 0.37, (1, 0.68, 0.12), 1)
scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'assets/buildables/flame.blend'), compress=True)
output = sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else '/tmp/acorn-flame.gltf'
bpy.ops.export_scene.gltf(filepath=output, export_format='GLTF_SEPARATE', export_yup=True,
                         export_animations=True, export_morph=True, export_frame_range=True)
