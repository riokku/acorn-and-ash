# Every upper-body top, fitted to the two faceted dwarves (decision 0292). Run inside Blender
# through the Blender MCP:
#
#     import sys; sys.path.insert(0, r'<repo>/tools/art')
#     import dwarf_tops as dt
#     dt.REPO = r'<repo>'
#     made = dt.build()                       # both bodies side by side, every top fitted to each
#     dt.render_views(made, out_dir)          # one picture per top, front and back
#     dt.export_all(made, tmp_dir)            # assets/gear/<file>.glb for every top
#
# The dwarves are built from loops of points (tools/art/heroic_dwarves.py), so a top is built the
# same way, from the same loops pushed out a little: a body, two sleeves, and bands for the collar,
# cuffs, hem and belt. It is weighted to the same bones by the same rule as the body under it, so
# it bends exactly as the body does. Everything is flat-shaded and coloured per facet, like the
# bodies. Each fit stays far under the props' 2,000-triangle budget.
#
# The two bodies share one skeleton, so both fits of a top go in one file on that skeleton, named
# <top>_dwarf1 and <top>_dwarf2; the game draws the one for the body wearing it and leaves out the
# parts of the body it covers. Facing -Y, Z up, the arms out along X, as the bodies are.
import importlib
import math
import os
import subprocess

import bpy
from mathutils import Vector

import heroic_dwarves as hd

importlib.reload(hd)

REPO = None  # set by the caller
BODY2_X = 1.1

SHOULDER_X, ELBOW_X, WRIST_X = .25, .45, .58
WAIST_Z = .47

# top -> its file, where its sleeves and hem end, how far it stands off the body, its colours, and
# its bands. A band is (where, from, to, colour, how much prouder): 'x' along the sleeve, 'z' round
# the body. The collar is always a band of its own.
TOPS = {
    'linen_shirt': dict(
        file='linen-shirt', sleeve_x=WRIST_X - .02, hem_z=.385, stand=.012,
        colour='#c2b895', shade='#a89e7c', collar=('#9c9274', .006),
        bands=[('x', WRIST_X - .07, WRIST_X - .02, '#9c9274', .008), ('z', .385, .415, '#9c9274', .006)]),
    'traveler_tunic': dict(
        file='traveler-tunic', sleeve_x=ELBOW_X + .04, hem_z=.33, stand=.018,
        colour='#679a5b', shade='#4f7a47', collar=('#44683d', .008),
        bands=[('z', .33, .36, '#44683d', .007), ('x', ELBOW_X, ELBOW_X + .04, '#44683d', .008),
               ('z', WAIST_Z - .03, WAIST_Z + .02, '#6b4a2e', .014)],
        buckle='#d0a94e'),
    'winter_jacket': dict(
        file='winter-jacket', sleeve_x=WRIST_X - .01, hem_z=.365, stand=.03,
        colour='#96493b', shade='#763629', collar=('#efe4c8', .024),
        bands=[('x', WRIST_X - .075, WRIST_X - .01, '#efe4c8', .018), ('z', .365, .405, '#efe4c8', .014)],
        quilted=True),
    'cedarstalker_coat': dict(
        file='cedarstalker-coat', sleeve_x=WRIST_X - .01, hem_z=.40, stand=.024,
        colour='#45694f', shade='#33503b', collar=('#80603e', .014),
        bands=[('x', WRIST_X - .065, WRIST_X - .01, '#80603e', .012),
               ('z', WAIST_Z - .03, WAIST_Z + .02, '#4a3524', .014)],
        skirt=dict(top=.44, bottom=.19, flare=.06, trim=('#80603e', .04)), buckle='#b0a890'),
}
NECK_Z = .925


# ---------------------------------------------------------------- the body's own shape

def torso_at(B, z):
    """The body's half-widths at a height: (side, front, back, squareness)."""
    rows = B['torso']
    if z <= rows[0][0]:
        return rows[0][1:]
    for (z0, *a), (z1, *b) in zip(rows, rows[1:]):
        if z <= z1:
            t = (z - z0) / (z1 - z0)
            return tuple(x + (y - x) * t for x, y in zip(a, b))
    return rows[-1][1:]


def body_loop(B, z, grow):
    rx, rf, rb, p = torso_at(B, z)
    return hd.ring((0, 0, z), (rx + grow, 0, 0), (0, rb + grow, 0), 12, p, v_neg=rf + grow)


def arm_shape(B):
    """The arm with its plain sleeve, as the body has it: (along, radius, flatness, lift)."""
    sz, sy = B['shoulder']
    ua, fa = B['upper_arm'], B['forearm']
    return [
        (.17, sz * .8, 1, -.01), (.235, sz, sy / sz, .004), (.30, sz * .97, sy / sz, 0),
        (.355, ua + .024, 1, 0), (.39, ua + .028, 1, 0), (.45, max(B['elbow'], ua * .92), 1, -.004),
        (.50, fa, 1, -.004), (.545, fa * .9, 1, 0), (.585, B['wrist'] * 1.08, 1.12, 0),
    ]


def arm_at(B, x):
    rows = arm_shape(B)
    if x <= rows[0][0]:
        return rows[0][1:]
    for (x0, *a), (x1, *b) in zip(rows, rows[1:]):
        if x <= x1:
            t = (x - x0) / (x1 - x0)
            return tuple(u + (v - u) * t for u, v in zip(a, b))
    return rows[-1][1:]


def arm_loop(B, x, grow):
    r, flat, lift = arm_at(B, x)
    return hd.ring((x, .072, .86 + lift), (0, (r + grow) * flat, 0), (0, 0, r + grow), 8, 2.3, phase=math.pi / 8)


# ---------------------------------------------------------------- one top on one body

CORE = ['hips', 'spine', 'chest']


def cloth(spec, quilted=False):
    main, shade = hd.hexc(spec['colour']), hd.hexc(spec['shade'])

    def colour(c, n):
        col = hd.mix(main, shade, hd.smooth(.5, -.6, n.z) * .8)
        if quilted and int(c.z / .055) % 2 == 0:
            col = hd.mix(col, shade, .45)  # rows of quilting
        return col
    return colour


def band_colour(hex_colour):
    base = hd.hexc(hex_colour)
    dark = tuple(x * .78 for x in base)
    return lambda c, n: hd.mix(base, dark, hd.smooth(.4, -.7, n.z))


def build_top(B, name, spec, rig, collection, material):
    S = hd.Sculpt('%s_%s' % (name, B['id']))
    g = spec['stand']
    quilted = spec.get('quilted', False)
    main = cloth(spec, quilted)

    # The body of it: the dwarf's own loops pushed out, from the hem to a close collar. The hem
    # stands clear of the plain shirt's own flared hem underneath.
    hem = spec['hem_z']
    heights = [hem, hem + .03] + [z for z in (.43, .52, .62, .72, .81, .885) if z > hem + .04]
    loops = []
    for z in heights:
        extra = .03 * hd.smooth(.50, .40, z)
        loops.append(body_loop(B, z, g + extra))
    nx, ny = B['neck']
    loops.append(hd.ring((0, .004, .918), (.156 + g, 0, 0), (0, .14 + g, 0), 12, 2.4))
    loops.append(hd.ring((0, .002, .957), (nx + .036 + g * .4, 0, 0), (0, ny + .034 + g * .4, 0), 12, 2.2))
    S.add(hd.loft(loops, cap_start=True, cap_end=False), main, hd.CLOTH, CORE, vary=.07)

    # The collar: a band standing round the neck.
    collar_colour, collar_out = spec['collar']
    c0 = collar_out + g * .4
    S.add(hd.loft([
        hd.ring((0, .004, .915), (.15 + g + collar_out, 0, 0), (0, .134 + g + collar_out, 0), 12, 2.4),
        hd.ring((0, .002, .962), (nx + .038 + c0, 0, 0), (0, ny + .036 + c0, 0), 12, 2.2),
        hd.ring((0, .002, .972), (nx + .02 + c0 * .4, 0, 0), (0, ny + .018 + c0 * .4, 0), 12, 2.2),
    ], cap_start=False, cap_end=False), band_colour(collar_colour), hd.CLOTH, ['chest', 'head'], vary=.08)

    # Sleeves, in the same two lengths of arm the body is made of, so they bend as it does.
    end = spec['sleeve_x']
    upper = [x for x in (.17, .235, .30, .355, .39) if x < end - .01]
    S.add(hd.loft([arm_loop(B, x, g) for x in upper]), main, hd.CLOTH, ['chest', 'upperarm.l'], both=True, vary=.07)
    if end > .40:
        lower = [.34] + [x for x in (.39, .45, .50, .545) if x < end - .012] + [end]
        S.add(hd.loft([arm_loop(B, x, g) for x in lower]), main, hd.CLOTH,
              ['upperarm.l', 'lowerarm.l', 'hand.l'], both=True, vary=.07)

    for where, a, b, colour, out in spec['bands']:
        if where == 'x':
            mid = (a + b) / 2
            S.add(hd.loft([arm_loop(B, a, g + out * .6), arm_loop(B, mid, g + out), arm_loop(B, b, g + out * .8)]),
                  band_colour(colour), hd.CLOTH, ['upperarm.l', 'lowerarm.l', 'hand.l'], both=True, vary=.08)
        else:
            extra = .03 * hd.smooth(.50, .40, (a + b) / 2)
            S.add(hd.loft([body_loop(B, a, g + extra + out * .7), body_loop(B, (a + b) / 2, g + extra + out),
                           body_loop(B, b, g + extra + out * .7)]),
                  band_colour(colour), hd.CLOTH, CORE, vary=.08)

    if 'buckle' in spec:
        rx, rf, rb, p = torso_at(B, WAIST_Z)
        y = -(rf + g + .03 * hd.smooth(.50, .40, WAIST_Z) + .016)
        z = WAIST_Z - .005
        S.add(hd.hull([(sx * .03, y - d, z + sz * .032) for sx in (1, -1) for sz in (1, -1) for d in (0, .012)]),
              spec['buckle'], hd.CLOTH, CORE, vary=.05)

    if 'skirt' in spec:
        skirt(S, B, spec, g)
    return S.finish(collection, [material], rig)


def skirt(S, B, spec, g):
    """The coat's skirt: a flared tube round both legs, which follows them halfway so it swings."""
    k = spec['skirt']
    top, bottom, flare = k['top'], k['bottom'], k['flare']

    def loop(z, grow):
        t = (top - z) / (top - bottom)
        rx, rf, rb, p = torso_at(B, max(z, .37))
        wide = max(rx, .14 + B['thigh'] * 1.04) + g + .012 + flare * t + grow
        return hd.ring((0, .004, z), (wide, 0, 0), (0, rb + g + .02 + flare * t + grow, 0), 12, 2.5,
                       v_neg=rf + g + .02 + flare * t * .8 + grow)

    def follows(co):
        down = hd.smooth(top, top - .12, co.z) * .5
        left = hd.smooth(-.08, .08, co.x)
        return {'hips': 1 - down, 'upperleg.l': down * left, 'upperleg.r': down * (1 - left)}

    mid = (top + bottom) / 2
    S.add(hd.loft([loop(top + .02, -.004), loop(top - .05, 0), loop(mid, 0), loop(bottom + .04, 0)],
                  cap_start=False, cap_end=False), cloth(spec), hd.CLOTH, follows, vary=.07)
    trim, depth = k['trim']
    S.add(hd.loft([loop(bottom + depth, .004), loop(bottom + depth / 2, .008), loop(bottom, .006), loop(bottom, -.01)],
                  cap_start=False, cap_end=False), band_colour(trim), hd.CLOTH, follows, vary=.08)


# ---------------------------------------------------------------- all of them

def cloth_material():
    mat = hd.material('dwarf_top_cloth', hd.CLOTH)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = .93
    return mat


def build():
    hd.REPO = REPO
    bodies = {'dwarf1': hd.build(hd.MAN), 'dwarf2': hd.build(hd.WOMAN, x=BODY2_X)}
    hd.show_beard(bodies['dwarf1'], 'braids')
    col = bpy.data.collections.get('dwarf_tops') or bpy.data.collections.new('dwarf_tops')
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    mat = cloth_material()
    tops = {}
    for name, spec in TOPS.items():
        for bid, made in bodies.items():
            ob = build_top(made['B'], name, spec, made['rig'], col, mat)
            tops[ob.name] = ob
    tris = {n: sum(len(p.vertices) - 2 for p in o.data.polygons) for n, o in tops.items()}
    return dict(bodies=bodies, tops=tops, tris=tris)


def show_only(made, name):
    for n, o in made['tops'].items():
        hidden = name is None or not n.startswith(name + '_')
        o.hide_render = o.hide_viewport = hidden


def render_views(made, out_dir, tops=None, views=('front', 'rear')):
    for body in made['bodies'].values():
        hd.relax_arms(body['rig'])
    paths = []
    for name in tops or TOPS:
        show_only(made, name)
        paths += hd.render_views(out_dir, name, views=views, target=(BODY2_X / 2, 0, .68), dist=5.6,
                                 size=(1100, 800))
    for body in made['bodies'].values():
        hd.rest(body['rig'])
    return paths


def export_all(made, tmp_dir):
    """Each top's two fits on the one skeleton, to assets/gear/<file>.glb, Meshopt-compressed."""
    rig = made['bodies']['dwarf1']['rig']
    other = made['bodies']['dwarf2']['rig']
    for body in made['bodies'].values():
        hd.rest(body['rig'])
    os.makedirs(tmp_dir, exist_ok=True)
    sizes = {}
    old_name = rig.name
    for name, spec in TOPS.items():
        fits = [made['tops']['%s_dwarf1' % name], made['tops']['%s_dwarf2' % name]]
        # Body 2's fit goes out on Body 1's copy of the skeleton: the two are the same.
        fits[1].parent = rig
        fits[1].modifiers['Armature'].object = rig
        for layer in bpy.context.scene.view_layers:
            for o in layer.objects:
                o.select_set(False, view_layer=layer)
        for o in (rig, *fits):
            o.hide_set(False)
            o.hide_viewport = False
            o.hide_render = False
            o.select_set(True)
        bpy.context.view_layer.objects.active = rig
        raw = os.path.join(tmp_dir, spec['file'] + '.glb')
        rig.name = hd.SKELETON
        try:
            bpy.ops.export_scene.gltf(
                filepath=raw, export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True,
                export_apply=False, export_skins=True, export_animations=False, export_def_bones=False,
                export_vertex_color='MATERIAL', export_all_vertex_colors=False,
                export_materials='EXPORT', export_extras=False)
        finally:
            rig.name = old_name
            fits[1].parent = other
            fits[1].modifiers['Armature'].object = other
        out = os.path.join(REPO, 'assets', 'gear', spec['file'] + '.glb')
        subprocess.run(['node', os.path.join(REPO, 'tools', 'import-model.mjs'), raw, out, '--quantize'],
                       cwd=REPO, check=True, shell=os.name == 'nt')
        sizes[spec['file']] = os.path.getsize(out)
    return sizes
