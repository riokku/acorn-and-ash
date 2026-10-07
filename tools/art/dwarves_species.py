# The dwarves: Dorrin (male) and Hilde (female), chibi proportions. Exec after dwarf_build.py.
# Head details are authored at a reference head size ('head_ref') and scaled up by 'k' with B.tx,
# so the big head keeps every feature in proportion. G scales the whole character to match the
# Quaternius characters (about 2 m before the game's own 0.6 scale).


def _mk(sp, **kw):
    sp.update(kw)
    sp['head'] = tuple(r * sp['k'] for r in sp['head_ref'])
    return sp


DORRIN = _mk(dict(
    name='dorrin', title='Dorrin', k=1.55, G=1.75,
    hx=.125, hip_z=.34, knee_z=.19, ankle_z=.07, waist_z=.43, shoulder_z=.62, neck_z=.67, head_zc=.83, head_ref=(.2, .185, .19), jaw=.06,
    sx=.28, elbow_z=.45, wrist_z=.29,
    pw=.22, pd=.19, ww=.26, wd=.23, cw=.27, cd=.22, nr=.13, belly=.07,
    thigh_r=(.115, .10), shin_r=(.10, .08), arm_r=(.09, .08), fore_r=(.085, .07), hand=(.072, .062, .072), foot=(.11, .15, .07),
    foot_cell=BOOT, legs_covered=True,
    palette=[hexc(c) for c in ('#f0b38a', '#d58866', '#f7d0b0', '#c25a2c', '#93401f', '#e8b84f', '#2b1d18', '#ffffff',
                              '#6e5038', '#a8693a', '#6a3f24', '#ee8f7e', '#5a3a26', '#a8472c', '#eaa184', '#c8645a')],
))
HILDE = _mk(dict(
    name='hilde', title='Hilde', k=1.6, G=1.75,
    hx=.115, hip_z=.33, knee_z=.185, ankle_z=.068, waist_z=.415, shoulder_z=.60, neck_z=.65, head_zc=.81, head_ref=(.19, .18, .185), jaw=0,
    sx=.25, elbow_z=.43, wrist_z=.275,
    pw=.21, pd=.17, ww=.2, wd=.18, cw=.23, cd=.19, nr=.1, belly=.04,
    thigh_r=(.105, .09), shin_r=(.09, .072), arm_r=(.075, .068), fore_r=(.07, .06), hand=(.062, .054, .066), foot=(.095, .14, .065),
    foot_cell=BOOT, legs_covered=True,
    palette=[hexc(c) for c in ('#f4c09c', '#d9946e', '#f9dabf', '#6a3b26', '#4a2818', '#e8b84f', '#22201e', '#ffffff',
                              '#f1e6c8', '#4f8a5a', '#6e4228', '#f2928a', '#4c8a5e', '#4d6a8a', '#efa98c', '#d06a6a')],
))


def head_tx(p):
    k = p['k']; zc = p['head_zc']
    return lambda co: Vector((co.x * k, co.y * k, zc + (co.z - zc) * k))


def ref(p):
    return dict(p, head=p['head_ref'])


def hairline(front, side, back, scallop=0.0, scallop_n=7):
    """Angle (radians from the top of the head) the hair reaches at each direction around the head."""
    f_, s_, b_ = math.radians(front), math.radians(side), math.radians(back)

    def phi(th):
        f = (1 - math.sin(th)) / 2          # 1 at the front, 0 at the back
        base = b_ + (s_ - b_) * min(1, f * 2) if f < .5 else s_ + (f_ - s_) * (f - .5) * 2
        return base + scallop * f * f * math.cos(scallop_n * th)
    return phi


def trousers_and_boots(B, p, trouser_cell, belt_cell):
    hx, hip, knee, ank = p['hx'], p['hip_z'], p['knee_z'], p['ankle_z']
    pw, pd, ww, wd, wz = p['pw'], p['pd'], p['ww'], p['wd'], p['waist_z']
    dz = wz - hip
    t = p['thigh_r']; s = p['shin_r']
    B.lathe('hips', trouser_cell, [(hip - .09, pw * .62 + .012, pd * .62 + .012), (hip - .05, pw * .88 + .012, pd * .9 + .012), (hip, pw + .012, pd + .012),
                                    (hip + dz * .45, (pw * .97 + ww) / 2 + .012, (pd + wd) / 2 + .012)], 16, wfn=hips_wfn(p))
    for sg, side in ((1, 'L'), (-1, 'R')):
        B.capsule('thigh_' + side, trouser_cell, sg * hx, 0, hip - .01, knee, t[0] + .013, t[1] + .014)
        B.capsule('shin_' + side, trouser_cell, sg * hx, 0, knee, ank + .06, s[0] + .014, s[1] + .02, flat_bottom=True)
        B.band('shin_' + side, BOOT, sg * hx, 0, ank + .078, ank - .01, s[1] + .022)   # boot shaft (the foot is the boot)
        B.band('shin_' + side, TRIM, sg * hx, 0, ank + .094, ank + .07, s[1] + .028)   # turned-down cuff
    h = hip
    B.lathe('hips', belt_cell, [(h + .03, pw + .016, pd + .016), (h + .095, pw + .016, pd + .016)], 16, wfn=hips_wfn(p))
    B.sphere('hips', GOLD, v(0, -(pd + .03), h + .062), (.046, .016, .041), seg=10, rings=6)
    B.sphere('hips', BOOT, v(0, -(pd + .04), h + .062), (.022, .008, .02), seg=8, rings=5)


def dorrin_extras(B, p):
    trousers_and_boots(B, p, CLOTH, TRIM)
    sh, wz, sx, wr = p['shoulder_z'], p['waist_z'], p['sx'], p['wrist_z']
    for sg in (1, -1):  # braces
        B.sphere('chest', CLOTH2, v(sg * .1, -p['cd'] * .92, (wz + sh) / 2 + .02), (.026, .016, .118), (0, 0, sg * -.07), seg=10, rings=7)
        B.sphere('chest', GOLD, v(sg * .104, -p['cd'] * 1.0, wz + .035), (.016, .008, .014), seg=6, rings=4)
    for sg, side in ((1, 'L'), (-1, 'R')):  # leather bracers
        B.band('forearm_' + side, TRIM, sg * sx, 0, wr + .085, wr + .015, p['fore_r'][1] + .016)

    pr = ref(p); zc = p['head_zc']; hrx, hry, hrz = p['head_ref']
    B.tx = head_tx(p)
    face(B, pr, .074, .025, (.036, .05), iris_cell=IRIS, nose=.058, nose_z=-.042, smile_w=0,
         brow=(HAIR_D, .052, .024, .28, .025))
    for sg in (1, -1):
        B.sphere('head', SKIN, v(sg * (hrx - .006), .012, zc - .005), (.032, .05, .058), seg=10, rings=7)
        B.sphere('head', SKIN_D, v(sg * (hrx + .012), .006, zc - .005), (.012, .032, .04), seg=8, rings=5)
        # cheek beard, joined to the sideburns
        B.sphere('head', HAIR, v(sg * .118, -.045, zc - .05), (.078, .1, .108), seg=12, rings=8)
        B.sphere('head', HAIR, v(sg * .15, .0, zc + .0), (.045, .06, .085), seg=10, rings=7)
        # moustache with curled tips
        mpos, mrot = on_face(pr, sg * .05, -.068, .014)
        B.sphere('head', HAIR, mpos, (.066, .036, .032), mrot @ Euler((0, sg * .32, 0)).to_quaternion(), seg=14, rings=8)
        tpos, _ = on_face(pr, sg * .105, -.048, .012)
        B.sphere('head', HAIR_D, tpos, (.026, .026, .026), seg=10, rings=6)
        # two braids with gold rings
        for (dx, dy, dz, r), ring in (((.074, -.112, -.215, .037), None), ((.08, -.118, -.295, .034), -.258), ((.083, -.12, -.365, .03), -.333)):
            B.sphere('head', HAIR_D, v(sg * dx, dy, zc + dz), (r, r, r * 1.35), seg=12, rings=8)
            if ring:
                B.sphere('head', GOLD, v(sg * dx, dy, zc + ring), (r * 1.15, r * 1.15, .013), seg=12, rings=5)
        B.sphere('head', HAIR, v(sg * .084, -.122, zc - .41), (.022, .022, .03), seg=8, rings=5)
    # big rounded beard
    B.sphere('head', HAIR, v(0, -.085, zc - .118), (.142, .118, .152), seg=14, rings=10)
    B.sphere('head', HAIR, v(0, -.1, zc - .235), (.095, .088, .105), seg=12, rings=8)
    B.sphere('head', HAIR_D, v(0, -.15, zc - .17), (.05, .03, .09), seg=10, rings=6)
    # short hair: clean shell with a little scalloped fringe and sideburns
    B.shell('head', HAIR, (0, .01, zc + .006), (hrx * 1.06, hry * 1.07, hrz * 1.08),
            hairline(56, 98, 122, scallop=.1, scallop_n=8), seg=26, rings=9,
            wobble=lambda th, ph: 1 + .028 * math.cos(9 * th) * math.sin(ph) ** 2)
    B.tx = None


def hilde_extras(B, p):
    trousers_and_boots(B, p, CLOTH2, BOOT)
    wz, sh = p['waist_z'], p['shoulder_z']
    # linen tunic (flares a little over the belt) with short sleeves trimmed in green
    # (the hem stays above the hip joints, so her thighs don't poke through it when she sits)
    rings = [(wz - .04, p['ww'] + .03, p['wd'] + .03, p['belly'])] + chest_rings(p, .013)
    B.lathe('chest', CLOTH, rings, 16, wfn=chest_wfn(p))
    B.lathe('chest', TRIM, [(wz - .043, p['ww'] + .033, p['wd'] + .033, p['belly']), (wz - .027, p['ww'] + .032, p['wd'] + .032, p['belly'])], 16, wfn=chest_wfn(p))
    for sg, side in ((1, 'L'), (-1, 'R')):
        B.capsule('upper_arm_' + side, CLOTH, sg * p['sx'], 0, sh - .03, p['elbow_z'] + .08, p['arm_r'][0] + .014, p['arm_r'][1] + .017, flat_bottom=True)
        B.band('upper_arm_' + side, TRIM, sg * p['sx'], 0, p['elbow_z'] + .098, p['elbow_z'] + .075, p['arm_r'][1] + .021)
    # laces at the neckline
    for dz in (.0, .03):
        B.sphere('chest', TRIM, v(0, -p['cd'] * .95 - .012, sh - .07 + dz), (.03, .008, .008), (0, 0, .5), seg=6, rings=4)
        B.sphere('chest', TRIM, v(0, -p['cd'] * .95 - .012, sh - .07 + dz), (.03, .008, .008), (0, 0, -.5), seg=6, rings=4)

    pr = ref(p); zc = p['head_zc']; hrx, hry, hrz = p['head_ref']
    B.tx = head_tx(p)
    face(B, pr, .071, .022, (.038, .054), iris_cell=IRIS, lashes=True, nose=.03, nose_z=-.04,
         smile_w=.032, smile_z=-.094, smile_curve=.5, brow=(HAIR_D, .036, .011, .22, .034))
    for sg in (1, -1):
        for fx, fz in ((.056, -.05), (.078, -.04), (.098, -.058), (.07, -.066)):
            fpos, frot = on_face(pr, sg * fx, fz, .002)
            B.sphere('head', SKIN_D, fpos, (.006, .002, .006), frot, seg=6, rings=3)
        # side buns tied with ribbon, then braids down to the shoulders
        B.sphere('head', HAIR, v(sg * .168, .045, zc + .07), (.08, .08, .08), seg=12, rings=8)
        B.sphere('head', TRIM, v(sg * .16, .03, zc + .015), (.05, .045, .022), seg=12, rings=6)
        for dx, dy, dz, r, cell in ((.172, .06, -.045, .048, HAIR), (.178, .068, -.12, .044, HAIR_D), (.182, .074, -.19, .04, HAIR)):
            B.sphere('head', cell, v(sg * dx, dy, zc + dz), (r, r, r * 1.3), seg=12, rings=8)
        B.sphere('head', GOLD, v(sg * .183, .076, zc - .237), (.032, .032, .013), seg=10, rings=5)
        B.sphere('head', HAIR, v(sg * .184, .078, zc - .27), (.03, .03, .036), seg=10, rings=6)
    # full hair: shell with a soft scalloped fringe, covering the ears and down to the nape
    B.shell('head', HAIR, (0, .012, zc + .008), (hrx * 1.08, hry * 1.09, hrz * 1.09),
            hairline(54, 104, 132, scallop=.12, scallop_n=9), seg=26, rings=9,
            wobble=lambda th, ph: 1 + .03 * math.cos(11 * th) * math.sin(ph) ** 2)
    B.tx = None


SPECIES = [(DORRIN, dorrin_extras), (HILDE, hilde_extras)]
NAMES = tuple(sp['name'] for sp, _ in SPECIES)


def build_character(sp, extras, x_offset):
    name = sp['name']
    defs = make_bone_defs(sp)
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    mat = make_material(name)
    B = Builder(list(defs.keys()))
    build_body(B, sp)
    extras(B, sp)
    mesh_ob = B.finish(name, mat, sp['palette'], sp.get('G', 1.0))
    col.objects.link(mesh_ob)
    arm = make_armature(name, defs)
    bpy.context.scene.collection.objects.unlink(arm)
    col.objects.link(arm)
    mesh_ob.parent = arm
    mesh_ob.modifiers.new('Armature', 'ARMATURE').object = arm
    arm.location.x = x_offset
    return arm, mesh_ob


def clear_characters():
    olds = NAMES + ('mossgrim', 'reedling', 'embervane')
    for c in list(bpy.data.collections):
        if c.name in olds:
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
    for d in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images, bpy.data.actions):
        for it in list(d):
            if it.users == 0 and it.name.startswith(olds):
                d.remove(it)


def build_all():
    clear_characters()
    return {sp['name']: build_character(sp, ex, x) for (sp, ex), x in zip(SPECIES, (-1.1, 1.1))}
