"""Build Bonehollow in Blender, and export matching shared collision boxes.
blender -b --python tools/art/skeleton_town.py -- /tmp/bonehollow.gltf
"""
import bpy
import math
import json
import os
import sys
import random
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(734)
solids=[]
modules={}


def material(name, color, glow=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=.9
    if glow:
        p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=glow
    return m
wood=material('Weathered cedar',(.20,.12,.075))
trim=material('Dark beams',(.065,.045,.03))
stone=material('Mossy masonry',(.26,.31,.23))
slate=material('Broken slate',(.10,.16,.17))
bone=material('Old ivory',(.68,.62,.41))
iron=material('Rusted iron',(.22,.11,.055))
cloth=material('Faded teal cloth',(.08,.24,.21))
glow=material('Ghost amber',(.85,.31,.055),1.3)


def box(name, x,y,z, w,h,d, mat, yaw=0, solid=True, lean=0):
    # Game coordinates to Blender Z-up; +game Z becomes -Blender Y.
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y))
    ob=bpy.context.object;ob.name=name;ob.scale=(w,d,h);ob.rotation_euler=(lean,0,yaw)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(mat)
    if solid:
        solids.append(dict(x=round(x,4),y=round(y,4),z=round(z,4),halfX=w/2,halfY=h/2,halfZ=d/2,yaw=yaw))
    modules.setdefault(name.split('.')[0],[]).append(ob)
    return ob


def orb(name,x,y,z,sx,sy,sz,mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,-z,y))
    ob=bpy.context.object;ob.name=name;ob.scale=(sx,sz,sy);ob.data.materials.append(mat)
    modules.setdefault(name.split('.')[0],[]).append(ob)
    return ob


def skull(name,x,y,z,size=.45):
    orb(name,x,y,z,size*.7,size*.7,size*.5,bone)
    # Recessed dark sockets face south, toward the road.
    for side in [-1,1]:
        orb(name,x+side*size*.27,y+size*.08,z+size*.42,size*.17,size*.2,size*.10,trim)
    for side in [-1,0,1]:box(name,x+side*size*.23,y-size*.5,z+size*.21,size*.14,size*.3,size*.3,bone,solid=False)


def house(name,cx,cz,w=6,d=6,yaw=0,roof=True):
    def piece(s,x,y,z,ww,hh,dd,mat,solid=True):
        # Rotation matches Three.js around world Y.
        xx=cx+math.cos(yaw)*x+math.sin(yaw)*z
        zz=cz-math.sin(yaw)*x+math.cos(yaw)*z
        return box(name+'.'+s,xx,y,zz,ww,hh,dd,mat,yaw,solid)
    # Shallow thresholds are walkable; walls leave a generous open doorway.
    piece('foundation',0,.03,0,w+.45,.12,d+.45,stone)
    piece('back',0,1.15,-d/2,w,2.3,.25,wood)
    for side in [-1,1]:
        piece('side',side*w/2,1.05,0,.24,2.1,d,wood)
        piece('front',side*(w/4+.6),.85,d/2,w/2-1.2,1.7,.24,wood)
        for z in [-d/2,d/2]:
            piece('post',side*w/2,1.5,z,.28,3,.28,trim)
        # Window frames painted into the broken wall above its low sill.
        piece('sill',side*(w/4+.6),1.72,d/2+.04,w/2-1.3,.14,.3,trim)
    piece('lintel',0,2.5,d/2,w,.24,.3,trim)
    piece('ridge',0,3.7,0,.23,.25,d+.7,trim)
    # Individual rising roof courses leave gaps and an uneven collapsed end.
    for side in [-1,1]:
        for course in range(5):
            xx=side*(course+.5)*w/10
            yy=3.7-(course+.5)*.23
            if roof or course%2==0:
                roof_piece=piece('roof',xx,yy,-.2,w/10+.16,.16,d+.65-(course%3)*.28,slate)
                pitch=side*math.atan(.23/(w/10))
                roof_piece.rotation_euler.y=pitch
                # Conservative pitched roof bounds keep jumping onto it solid.
                hx,hy=solids[-1]['halfX'],solids[-1]['halfY']
                solids[-1]['halfX']=abs(math.cos(pitch))*hx+abs(math.sin(pitch))*hy
                solids[-1]['halfY']=abs(math.sin(pitch))*hx+abs(math.cos(pitch))*hy
    # A leaning chimney remnant and weathered board seams.
    piece('chimney',w/2-.5,2.2,-d/2+.6,.65,4.4,.65,stone)
    for side in [-1,1]:
        for row in range(5):
            piece('boards',side*w/2+side*.13,.25+row*.39,0,.04,.045,d-.15,trim,False)
    skull(name+'.skull',cx,2.9,cz+d/2+.16,.26)

house('CedarHouse',-23,13,yaw=math.pi/2)
house('WatchHouse',23,13,yaw=-math.pi/2,roof=False)
house('Apothecary',-23,-13,yaw=math.pi/2,roof=False)
house('CryptHouse',23,-16,yaw=-math.pi/2)
house('BellHall',0,-26,w=9,d=5,roof=False)
# Central bell scaffold; open below, so the square stays traversable.
for side in [-1,1]:box('BellTower.post',side*2,3.5,-24,.35,7,.35,trim)
box('BellTower.crossbar',0,6.8,-24,4.6,.35,.4,trim)
orb('BellTower.bell',0,5.6,-24,.68,.8,.68,iron)
box('BellTower.chain',0,6.3,-24,.07,.9,.07,iron,solid=False)
skull('BellTower.crown',0,7.15,-24,.5)
# Bone gate: broad exits on either side, and a clear ten-metre central road.
for side in [-1,1]:
    box('Gate.pillar',side*5,1.7,28,1,3.4,1,stone)
    box('Gate.cap',side*5,3.5,28,1.3,.25,1.3,bone)
    skull('Gate.skull',side*5,4.05,28,.55)
box('Gate.arch',0,3.2,28,10,.25,.35,trim)
box('Gate.sign',0,2.85,28,3.8,.55,.12,wood,solid=False)
# The Blender text is part of the model, keeping the town readable without a HUD.
bpy.ops.object.text_add(location=(-1.65,-28.09,2.65),rotation=(math.pi/2,0,0))
t=bpy.context.object;t.name='Gate.name';t.data.body='BONEHOLLOW';t.data.size=.43;t.data.resolution_u=1;t.data.extrude=.005;t.data.materials.append(bone)
bpy.ops.object.convert(target='MESH');modules.setdefault('Gate',[]).append(bpy.context.object)
# Abandoned market stalls with staggered awnings.
for i in range(3):
    x=-12+i*3.3;z=6
    for dx in [-1,1]:box('Market.post',x+dx,1.25,z,.11,2.5,.11,trim)
    box('Market.counter',x,.75,z,2.3,.2,1,wood)
    box('Market.awning',x,2.5,z,2.5,.12,1.7,cloth,solid=True)
    for n in range(3):orb('Market.pots',x-.65+n*.6,1,z,.2,.22,.2,iron if n%2 else stone)
# Well off the central travel line.
for angle in range(8):
    a=angle*math.tau/8
    box('Well.stones',math.cos(a)*1.15,.5,-3+math.sin(a)*1.15,.9,1,.38,stone,yaw=-a)
# Graves stay at the east edge, leaving the patrol circle open.
for row in range(3):
    for col in range(3):
        x=20+col*2;z=-4+row*2.7
        box('Graves.marker',x,.6,z,.65,1.2,.22,stone,yaw=(row-col)*.04)
        skull('Graves.carving',x,.8,z+.15,.14)
        box('Graves.slab',x,.02,z+.8,.8,.06,1.25,stone,solid=False)
# Square paving and two connected, ragged roads. These sit below the walking step.
for ix in range(-23,24):
    for iz in range(-24,25):
        x,z=ix*1.1,iz*1.1
        road=abs(x)<2.2 or abs(z-12)<1.5 or abs(z+13)<1.5 or (abs(z+1)<1.6 and abs(x)<23)
        plaza=math.hypot(x,z+3)<6
        if not (road or plaza) or rng.random()<.12:continue
        orb('Road.cobble',x+rng.uniform(-.15,.15),-.035,z+rng.uniform(-.15,.15),
            rng.uniform(.42,.62),.075,rng.uniform(.42,.62),stone)
# Broken garden fences and abandoned timber piles add irregular silhouettes.
for x,z in [(-19,20),(18,21),(-18,-21),(17,-24)]:
    for post in range(3):
        box('Debris.fence',x+post*.85,.6,z,.13,1.2,.13,trim)
    box('Debris.rail',x+.85,.75,z,2.2,.16,.14,wood)
    for n in range(3):
        box('Debris.plank',x+n*.3,.08+n*.08,z+1.2,1.6,.15,.2,wood,yaw=.25+n*.3)
# Bone standards and abandoned barricades sit beside, never across, the exits.
for x,z in [(-7,24),(7,24),(-8,-20),(8,-20),(-28,0),(28,2)]:
    box('Standards.pole',x,1.4,z,.12,2.8,.12,trim)
    box('Standards.flag',x+.4,2.2,z,.7,.95,.04,cloth,solid=False)
    skull('Standards.top',x,3,z,.3)
# Dress pieces for skeleton heads, exported separately from the town.
# A small rusted watchman's crest and moss-green scavenger cap use existing head bones.
for name,mat in [('TownWatch',iron),('TownScavenger',cloth)]:
    orb(name+'.cap',0,.08,0,.24,.13,.22,mat)
    box(name+'.band',0,0,.02,.48,.07,.42,trim,solid=False)
    if name=='TownWatch':box(name+'.crest',0,.24,0,.07,.28,.35,iron,solid=False)
    else:orb(name+'.badge',0,.07,.22,.07,.07,.025,bone)
# Join each module for compact scene traversal, preserving material slots.
for name,objects in modules.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join();bpy.context.object.name=name
# Headwear isn't placed in the settlement and never supplies world collision.
solids=[s for s in solids if not (abs(s['x'])<.01 and abs(s['z'])<.01 and s['y']<.4)]
with open(os.path.join(ROOT,'packages/shared/src/data/skeleton-town-solids.json'),'w') as f:
    json.dump(solids,f,separators=(',',':'));f.write('\n')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/settlements/bonehollow.blend'),compress=True)
output=sys.argv[sys.argv.index('--')+1]
bpy.ops.export_scene.gltf(filepath=output,export_format='GLTF_SEPARATE',export_yup=True)
for name in modules:
    ob=bpy.data.objects[name]
    print(name,sum(len(p.vertices)-2 for p in ob.data.polygons),'triangles')
