"""Authored cedar roofing and joinery for the established cabin footprints.
Run: blender -b --threads 2 --python tools/art/housing_details.py -- /tmp/housing-details.gltf
"""
import bpy
import math
import os
import sys
import random
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = random.Random(271)
modules = {}


def material(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = .92
    return m


cedar = [material('Cedar shake '+str(i), (.23+i*.016, .135+i*.012, .072+i*.009)) for i in range(4)]
trim = material('Cedar trim', (.27, .155, .08))
iron = material('Forged iron', (.055, .065, .065))
stone = material('Cap stone', (.25, .27, .24))


def box(module, x, y, z, w, h, d, mat, pitch=0, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    ob = bpy.context.object
    ob.name = module
    ob.scale = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.rotation_euler.x = pitch
    ob.data.materials.append(mat)
    if bevel:
        mod = ob.modifiers.new('Hand eased edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
    modules.setdefault(module, []).append(ob)
    return ob


def beam(module, a, b, width, mat):
    a, b = Vector((a[0], -a[2], a[1])), Vector((b[0], -b[2], b[1]))
    mid = (a+b)/2
    ob = box(module, mid.x, mid.z, -mid.y, width, (b-a).length, width, mat, bevel=.012)
    ob.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()


wall = .2 + (.15*1.86)*8.5 + .15*.6
ridge = wall+1.45
pitch = 1.45/1.95
angle = math.atan(pitch)
# Overlapping, staggered shakes; slight lengths and shades make real course shadows.
for side, run, module in [(1, 2.4, 'CabinRoofFront'), (-1, 2.2, 'CabinRoofBack')]:
    for row in range(9):
        step = run/9
        z = side*(run-(row+.5)*step)
        for col in range(18):
            x = -2.44+(col+.5)*4.88/18
            # Joints drift without exceeding the existing roof silhouette.
            x += (.035 if row%2 else -.035) if 0<col<17 else 0
            y = ridge-abs(z)*pitch+.16+row*.006
            box(module, x, y, z, .260, .045, (step+.1)*math.sqrt(1+pitch*pitch),
                rng.choice(cedar), side*angle)
    for x in [-2.44, 2.44]:
        beam('CabinJoinery', (x,ridge+.10,0), (x,ridge-run*pitch+.10,side*run), .14, trim)
    beam('CabinJoinery', (-2.44,ridge-run*pitch+.04,side*run),
         (2.44,ridge-run*pitch+.04,side*run), .12, trim)
# Gable king posts and diagonal framing, kept against the original walls.
for x in [-2.09, 2.09]:
    beam('CabinJoinery',(x,wall,0),(x,ridge-.16,0),.12,trim)
    for side in [-1,1]:
        beam('CabinJoinery',(x,wall,side*1.5),(x,ridge-.38,0),.11,trim)
# Slatted shutters alongside the window and forged door straps.
for x in [.51,1.79]:
    for plank in [-1,0,1]:
        box('CabinJoinery',x+plank*.07,1.425,1.99,.065,.76,.065,trim,bevel=.008)
    for y in [1.16,1.68]:box('CabinHardware',x,y,2.032,.21,.035,.02,iron)
for y in [.55,1.68]:
    box('CabinHardware',-.86,y,1.995,.25,.055,.025,iron,bevel=.008)
# A raised rain cap with a dark vent under it, rather than a solid slab.
for x in [2.12,2.52]:
    for z in [-.75,-.35]:box('CabinHardware',x,ridge+.86,z,.035,.25,.035,iron)
box('CabinHardware',2.32,ridge+1.01,-.55,.66,.085,.7,stone,bevel=.025)
# Large-cabin porch: separate authored module in the large cabin's coordinates.
for row in range(3):
    z=3.23-row*.40
    for col in range(10):
        x=-1.85+(col+.5)*.37
        box('PorchRoof',x,2.39-(z-2.63)*math.tan(.12)+row*.008,z,.355,.04,.49,
            rng.choice(cedar),.12)
for x in [-1.62,1.62]:
    beam('PorchJoinery',(x,1.6,3.07),(x-math.copysign(.42,x),2.13,3.07),.105,trim)
    beam('PorchJoinery',(x,1.6,3.07),(x,2.13,2.65),.105,trim)
    box('PorchJoinery',x,.92,2.63,.16,.055,1.04,trim,bevel=.015)
beam('PorchJoinery',(-1.84,2.28,3.25),(1.84,2.28,3.25),.13,trim)
# Shaped canvas panels: smooth tension folds, with all pegged edges and doorways fixed.
tent_canvas = material('Tent Canvas', (.54,.58,.40))
teepee_canvas = material('Teepee Canvas', (.78,.66,.46))


def canvas_panel(module, a, b, c, mat, fullness=.20):
    a,b,c = Vector(a),Vector(b),Vector(c)
    normal=(b-a).cross(c-a).normalized()
    # Choose an inward normal: stretched cloth relaxes between its supports.
    mid=(a+b+c)/3
    if normal.dot(Vector((mid.x, 0, mid.z))) > 0:normal=-normal
    vertices=[];faces=[];lookup={};steps=6
    for i in range(steps+1):
        for j in range(steps+1-i):
            u,v=i/steps,j/steps
            w=1-u-v
            p=a*w+b*u+c*v
            fold=27*u*v*w
            p+=normal*(fullness*fold*(.7+.3*math.sin((u-v)*math.pi*3)))
            lookup[(i,j)]=len(vertices)
            vertices.append((p.x,-p.z,p.y))
    for i in range(steps):
        for j in range(steps-i):
            faces.append((lookup[i,j],lookup[i+1,j],lookup[i,j+1]))
            if i+j<steps-1:faces.append((lookup[i+1,j],lookup[i+1,j+1],lookup[i,j+1]))
    mesh=bpy.data.meshes.new(module);mesh.from_pydata(vertices,[],faces);mesh.update()
    ob=bpy.data.objects.new(module,mesh);bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    for polygon in mesh.polygons:polygon.use_smooth=True
    modules.setdefault(module,[]).append(ob)


def shelter(kind, scale):
    dx=-.575*scale;depth=2.05*scale
    def panel(a,b,c):canvas_panel(kind+'Canvas',a,b,c,tent_canvas if kind=='Tent' else teepee_canvas)
    if kind=='Tent':
        lf=(-1.3,.07,depth);rf=(1.54,.07,depth)
        lb=(-1.3,.07,-depth);rb=(1.54,.07,-depth)
        pf=(dx,2.12,depth);pb=(dx,2.12,-depth)
        for a,b,c in [(lf,lb,pb),(lf,pb,pf),(rf,pf,pb),(rf,pb,rb),(lb,rb,pb)]:panel(a,b,c)
        dl=(dx-.43,.07,depth+.01);dr=(dx+.43,.07,depth+.01);top=(dx,1.48,depth+.015)
        for a,b,c in [(lf,dl,top),(lf,top,pf),(dr,rf,pf),(dr,pf,top)]:panel(a,b,c)
    else:
        peak=(dx,3.36,-.08)
        def rim(i):
            angle=i*math.pi*2/16
            return (.16+math.sin(angle)*1.83,.07,math.cos(angle)*depth)
        for i in range(1,15):panel(rim(i),rim(i+1),peak)
        top=(dx,1.95,depth*.72);dl=(dx-.43,.07,depth);dr=(dx+.43,.07,depth)
        for a,b,c in [(rim(1),dr,top),(rim(1),top,peak),(dl,rim(15),peak),(dl,peak,top)]:panel(a,b,c)


shelter('Tent', .6)
shelter('Teepee', .8)

for name, objects in modules.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    ob=bpy.context.object
    ob.name=name
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    tris=sum(len(p.vertices)-2 for p in ob.data.polygons)
    print(name, tris, 'triangles')
    assert tris <= 2000
os.makedirs(ROOT+'/assets/housing',exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/housing/cabin-details.blend',compress=True)
out=sys.argv[sys.argv.index('--')+1]
bpy.ops.export_scene.gltf(filepath=out,export_format='GLTF_SEPARATE',export_yup=True)
