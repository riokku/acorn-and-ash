"""Bonehollow captain/player helm, authored in Blender in game metres."""
import bpy, math, os, sys
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,rgb):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=.6
    return m
steel=mat('Weathered teal steel',(.12,.30,.29));bronze=mat('Old watch bronze',(.48,.30,.10));dark=mat('Leather lining',(.07,.055,.04))
def box(name,x,y,z,w,h,d,m):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    mod=o.modifiers.new('Eased edges','BEVEL');mod.width=.008;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
# A hollow, open-faced helmet; the face stays readable in all six bodies.
vertices=[];faces=[]
for y,r in [(0,.27),(.18,.27),(.32,.23),(.40,.08)]:
    for i in range(12):
        a=i*math.tau/12;vertices.append((r*math.cos(a),r*math.sin(a),y))
for row in range(3):
    for i in range(12):faces.append((row*12+i,row*12+(i+1)%12,(row+1)*12+(i+1)%12,(row+1)*12+i))
mesh=bpy.data.meshes.new('Watch helm');mesh.from_pydata(vertices,[],faces);mesh.update()
o=bpy.data.objects.new('LastWatchHelm',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(steel)
for side in [-1,1]:
    box('Cheek guard',side*.24,-.065,.015,.045,.18,.18,steel)
    box('Bronze rim',side*.26,.015,.0,.035,.055,.32,bronze)
# A distinctive three-point crest, visible on both the captain and its earned copy.
for z,height in [(-.12,.18),(0,.28),(.12,.18)]:
    box('Watch crest',0,.40+height/2,z,.055,height,.10,bronze)
box('Brow',0,.025,.245,.39,.055,.04,bronze)
box('Watch seal',0,.10,.252,.09,.12,.035,steel)
box('Neck guard',0,-.06,-.23,.33,.16,.05,dark)
os.makedirs(ROOT+'/assets/gear',exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/gear/last-watch-helm.blend',compress=True)
bpy.ops.export_scene.gltf(filepath=sys.argv[sys.argv.index('--')+1],export_format='GLTF_SEPARATE',export_yup=True)
