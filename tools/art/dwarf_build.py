# Shared builder for the Acorn & Ash dwarves, run inside Blender through the Blender MCP.
# Load order: dwarf_build.py, dwarves_species.py, dwarf_anim.py, dwarf_preview.py; then build_all().
#
# Everything is built from simple rounded shapes into ONE skinned mesh:
# - colours come from a small palette and are painted on as vertex colours, shaded by which
#   way each corner faces, so tops read lighter and undersides darker (a cheap baked light,
#   like the Quaternius characters) - no texture, so no colour bleeding at a distance;
# - limbs blend their weights with the neighbouring bone near each joint, so elbows,
#   knees, shoulders and the waist bend smoothly instead of as separate pieces;
# - hair is a shell that follows the head with a shaped hairline, so its edge is clean.
import math
import bpy
import bmesh
from mathutils import Matrix, Vector, Euler

# palette slots
SKIN, SKIN_D, SKIN_L, HAIR, HAIR_D, GOLD, EYE, EYEHI, CLOTH, TRIM, BOOT, BLUSH, IRIS, CLOTH2, NOSE, LIP = range(16)


def v(x, y, z):
    return Vector((x, y, z))


def smoothstep(a, b, x):
    if a == b:
        return 1.0 if x >= b else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# which bone sits above (parent) and below (child) each limb segment, for joint blending
LIMB_LINKS = {
    'thigh': ('hips', 'shin'), 'shin': ('thigh', 'foot'),
    'upper_arm': ('chest', 'forearm'), 'forearm': ('upper_arm', 'hand'),
}


def limb_neighbours(bone):
    for base, (up, down) in LIMB_LINKS.items():
        if bone.startswith(base + '_'):
            side = bone[len(base):]
            up_name = up + side if up in ('thigh', 'upper_arm') else up
            return up_name, down + side
    return None, None


class Builder:
    def __init__(self, bones):
        self.bm = bmesh.new()
        self.bones = bones
        self.dl = self.bm.verts.layers.deform.verify()
        self.fc = self.bm.faces.layers.int.new("cell")
        self.tx = None  # optional Vector -> Vector map applied to every part added (head details)

    # -- bookkeeping -------------------------------------------------------
    def _tag(self, verts, bone, cell):
        verts = list(dict.fromkeys(verts))
        bi = self.bones.index(bone)
        if self.tx:
            for vt in verts:
                vt.co = self.tx(vt.co)
        faces = set()
        for vt in verts:
            dv = vt[self.dl]
            dv.clear()
            dv[bi] = 1.0
            faces.update(vt.link_faces)
        for f in faces:
            f[self.fc] = cell
        return verts

    def weigh(self, verts, fn):
        """fn(co) -> {bone: weight} for the bones that share this vertex (rest stays on its own bone)."""
        for vt in verts:
            extra = fn(vt.co)
            if not extra:
                continue
            dv = vt[self.dl]
            own = list(dv.keys())[0]
            total = 0.0
            for b, w in extra.items():
                if w > 1e-4:
                    dv[self.bones.index(b)] = w
                    total += w
            dv[own] = max(0.0, 1.0 - total)

    # -- primitives ----------------------------------------------------------
    def lathe(self, bone, cell, rings, seg=12, cx=0.0, cy=0.0, wfn=None):
        bm = self.bm
        ringverts, made = [], []
        for r in rings:
            z, rx, ry = r[0], r[1], r[2]
            yo = r[3] if len(r) > 3 else 0.0
            if rx < 1e-5:
                p = bm.verts.new((cx, cy + yo, z)); made.append(p)
                ringverts.append([p] * seg)
            else:
                vs = [bm.verts.new((cx + rx * math.cos(2 * math.pi * j / seg), cy + yo + ry * math.sin(2 * math.pi * j / seg), z)) for j in range(seg)]
                made += vs
                ringverts.append(vs)
        for i in range(len(rings) - 1):
            for j in range(seg):
                k = (j + 1) % seg
                quad = list(dict.fromkeys([ringverts[i][j], ringverts[i][k], ringverts[i + 1][k], ringverts[i + 1][j]]))
                if len(quad) >= 3:
                    bm.faces.new(quad)
        for ring_i in (0, len(rings) - 1):
            if rings[ring_i][1] >= 1e-5:
                z = rings[ring_i][0]; yo = rings[ring_i][3] if len(rings[ring_i]) > 3 else 0.0
                c = bm.verts.new((cx, cy + yo, z)); made.append(c)
                for j in range(seg):
                    bm.faces.new((ringverts[ring_i][j], ringverts[ring_i][(j + 1) % seg], c))
        made = self._tag(made, bone, cell)
        if wfn:
            self.weigh(made, wfn)
        return made

    def band(self, bone, cell, cx, cy, ztop, zbot, r, seg=12):
        """A short flat-ended ring around a limb (cuffs, bracers, boot tops) with softly rounded edges.
        Unlike a capsule it has no rounded ends hiding inside the limb, so nothing pokes out when
        the joint bends."""
        e = min(.006, (ztop - zbot) / 4)
        return self.lathe(bone, cell, [(ztop, r * .9, r * .9), (ztop - e, r, r), (zbot + e, r, r), (zbot, r * .9, r * .9)], seg, cx, cy)

    def capsule(self, bone, cell, cx, cy, ztop, zbot, rtop, rbot, yscale=1.0, seg=10, mid=None, blend=True, flat_bottom=False):
        """A rounded limb segment from ztop down to zbot. Near each end it shares weight with the
        neighbouring bone so the joint bends smoothly. flat_bottom ends it with a flat cap at zbot
        (for sleeves and trouser legs that stop part-way)."""
        if mid is None:
            mid = (rtop + rbot) / 2 * 1.1
        rings = [(ztop + rtop, 0.0, 0.0)]
        for a in (60, 25):
            s = math.sin(math.radians(a)); c = math.cos(math.radians(a))
            rings.append((ztop + rtop * s, rtop * c, rtop * c * yscale))
        rings.append((ztop, rtop, rtop * yscale))
        rings.append(((ztop + zbot) / 2, mid, mid * yscale))
        rings.append((zbot, rbot, rbot * yscale))
        if not flat_bottom:
            for a in (-25, -60):
                s = math.sin(math.radians(a)); c = math.cos(math.radians(a))
                rings.append((zbot + rbot * s, rbot * c, rbot * c * yscale))
            rings.append((zbot - rbot, 0.0, 0.0))
        up, down = limb_neighbours(bone) if blend else (None, None)

        def wfn(co):
            out = {}
            if up:
                out[up] = .5 * smoothstep(ztop - rtop * 1.1, ztop + rtop * .4, co.z)
            if down:
                out[down] = .5 * smoothstep(zbot + rbot * 1.1, zbot - rbot * .4, co.z)
            return out
        return self.lathe(bone, cell, rings, seg, cx, cy, wfn if (up or down) else None)

    def sphere(self, bone, cell, c, r, rot=(0, 0, 0), seg=10, rings=7):
        R = rot.to_matrix().to_4x4() if hasattr(rot, 'to_matrix') else Euler(rot).to_matrix().to_4x4()
        M = Matrix.Translation(c) @ R @ Matrix.Diagonal((r[0], r[1], r[2], 1))
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=1.0, matrix=M)
        return self._tag(res["verts"], bone, cell)

    def cone(self, bone, cell, base, tip, r_base, r_tip=0.004, seg=8, flat=1.0):
        base = Vector(base); tip = Vector(tip)
        d = tip - base
        up = 'X' if abs(d.normalized().y) > 0.9 else 'Y'
        R = d.to_track_quat('Z', up).to_matrix().to_4x4()
        M = Matrix.Translation((base + tip) / 2) @ R @ Matrix.Diagonal((flat, 1, 1, 1))
        res = bmesh.ops.create_cone(self.bm, cap_ends=False, cap_tris=False, segments=seg, radius1=r_base, radius2=r_tip, depth=d.length, matrix=M)
        return self._tag(res["verts"], bone, cell)

    def shell(self, bone, cell, centre, radii, phi_max, seg=28, rings=10, wobble=None, lip=.94):
        """Part of an ellipsoid from its top pole down to a shaped edge.
        phi_max(theta) is how far down (radians from the top) it reaches at each angle;
        theta = -pi/2 faces the front (-Y). wobble(theta, phi) scales the radius (hair clumps).
        The edge tucks inward (lip) so it reads as a thick, clean rim."""
        bm = self.bm
        cx, cy, cz = centre
        rx, ry, rz = radii
        top = bm.verts.new((cx, cy, cz + rz * (wobble(0, 0) if wobble else 1)))
        grid = []
        for i in range(1, rings + 1):
            row = []
            for j in range(seg):
                th = 2 * math.pi * j / seg - math.pi
                ph = phi_max(th) * i / rings
                w = wobble(th, ph) if wobble else 1.0
                row.append(bm.verts.new((cx + rx * w * math.sin(ph) * math.cos(th), cy + ry * w * math.sin(ph) * math.sin(th), cz + rz * w * math.cos(ph))))
            grid.append(row)
        rim = []
        for j in range(seg):
            th = 2 * math.pi * j / seg - math.pi
            ph = phi_max(th)
            rim.append(bm.verts.new((cx + rx * lip * math.sin(ph) * math.cos(th), cy + ry * lip * math.sin(ph) * math.sin(th), cz + rz * lip * math.cos(ph) - .006)))
        grid.append(rim)
        for j in range(seg):
            bm.faces.new((top, grid[0][(j + 1) % seg], grid[0][j]))
        for i in range(len(grid) - 1):
            for j in range(seg):
                k = (j + 1) % seg
                bm.faces.new((grid[i][j], grid[i][k], grid[i + 1][k], grid[i + 1][j]))
        made = [top] + [x for row in grid for x in row]
        return self._tag(made, bone, cell)

    # -- output ----------------------------------------------------------
    def finish(self, name, mat, palette, G=1.0):
        bm = self.bm
        bmesh.ops.scale(bm, vec=(G, G, G), verts=bm.verts)  # design units -> final size (origin at the ground)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        facecells = [f[self.fc] for f in bm.faces]
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        for b in self.bones:  # same order as the deform-layer indices
            ob.vertex_groups.new(name=b)
        # Colours are painted on the mesh corners (vertex colours), not read from a texture, so
        # neighbouring colours can never bleed into each other at a distance. Each corner is
        # shaded by which way it faces: tops lighter, undersides darker (a soft baked light).
        col = me.color_attributes.new("Col", 'BYTE_COLOR', 'CORNER')
        for p, cell in zip(me.polygons, facecells):
            p.use_smooth = True
            c = palette[cell]
            for li in p.loop_indices:
                nz = me.vertices[me.loops[li].vertex_index].normal.z
                shade = SHADE_DOWN + (SHADE_UP - SHADE_DOWN) * (.5 + .5 * nz)
                col.data[li].color_srgb = (min(1, c[0] * shade), min(1, c[1] * shade), min(1, c[2] * shade), 1.0)
        me.color_attributes.active_color = col
        me.materials.append(mat)
        return ob


SHADE_DOWN, SHADE_UP = .80, 1.06


def make_material(name):
    """One soft, matte material that takes its colour from the mesh's vertex colours."""
    mat = bpy.data.materials.new(name + "_mat")
    mat.use_nodes = True
    nt = mat.node_tree
    vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Col"
    b = nt.nodes["Principled BSDF"]
    nt.links.new(vc.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.85
    return mat


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def head_rings(zc, rx, ry, rz, jaw=0.0, n=14):
    rings = []
    for k in range(n + 1):
        a = -90 + 180 * k / n
        s = math.sin(math.radians(a)); c = math.cos(math.radians(a))
        w = 1 + jaw * max(0.0, -s) * c * 1.4
        rings.append((zc + rz * s, rx * c * w if abs(a) < 89 else 0.0, ry * c if abs(a) < 89 else 0.0))
    return rings


def make_bone_defs(p):
    hx, hip, knee, ank = p['hx'], p['hip_z'], p['knee_z'], p['ankle_z']
    sx, sh, el, wr = p['sx'], p['shoulder_z'], p['elbow_z'], p['wrist_z']
    B = {}
    B['root'] = (None, v(0, 0, 0), v(0, 0, 0.15))
    B['hips'] = ('root', v(0, 0, hip), v(0, 0, hip + 0.1))
    B['spine'] = ('hips', v(0, 0, hip + 0.1), v(0, 0, p['waist_z'] + 0.1))
    B['chest'] = ('spine', v(0, 0, p['waist_z'] + 0.1), v(0, 0, sh))
    B['neck'] = ('chest', v(0, 0, sh), v(0, 0, p['neck_z']))
    B['head'] = ('neck', v(0, 0, p['neck_z']), v(0, 0, p['head_zc'] + p['head'][2]))
    for s, sgn in (('L', 1), ('R', -1)):
        B['upper_arm_' + s] = ('chest', v(sgn * sx, 0, sh - 0.03), v(sgn * sx, 0, el))
        B['forearm_' + s] = ('upper_arm_' + s, v(sgn * sx, 0, el), v(sgn * sx, 0, wr))
        B['hand_' + s] = ('forearm_' + s, v(sgn * sx, 0, wr), v(sgn * sx, 0, wr - 0.1))
        B['thigh_' + s] = ('hips', v(sgn * hx, 0, hip), v(sgn * hx, 0, knee))
        B['shin_' + s] = ('thigh_' + s, v(sgn * hx, 0, knee), v(sgn * hx, 0, ank))
        B['foot_' + s] = ('shin_' + s, v(sgn * hx, 0, ank), v(sgn * hx, -0.12, ank - 0.03))
    G = p.get('G', 1.0)
    return {k: (par, h * G, t * G) for k, (par, h, t) in B.items()}


def make_armature(name, defs):
    arm = bpy.data.armatures.new(name + "_rig")
    ob = bpy.data.objects.new(name + "_rig", arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for bn, (par, h, t) in defs.items():
        eb = arm.edit_bones.new(bn)
        eb.head = h; eb.tail = t; eb.roll = 0.0
        if par:
            eb.parent = arm.edit_bones[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.display_type = 'STICK'
    return ob


def chest_wfn(p):
    """Lower chest follows the spine, so leaning bends the belly rather than snapping at the waist."""
    wz = p['waist_z']
    return lambda co: {'spine': 1 - smoothstep(wz - .02, wz + .12, co.z)}


def hips_wfn(p):
    hip, wz = p['hip_z'], p['waist_z']
    return lambda co: {'spine': .5 * smoothstep(hip + .03, wz, co.z)}


def chest_rings(p, grow=0.0):
    wz, sh = p['waist_z'], p['shoulder_z']
    ww, wd, cw, cd, nr, belly = p['ww'], p['wd'], p['cw'], p['cd'], p['nr'], p['belly']
    tt = sh - wz
    g = grow
    return [(wz - 0.01, ww + g, wd + g, belly), (wz + tt * .3, (ww + cw) / 2 * 1.02 + g, (wd + cd) / 2 + g, belly * .8),
            (wz + tt * .6, (ww + cw) / 2 * 1.08 + g, (wd + cd) / 2 * 1.04 + g, belly * .4), (wz + tt * .85, cw + g, cd + g),
            (sh - 0.015, cw * .9 + g, cd * .9 + g), (sh + 0.02, max(nr * 2.0, cw * .55) + g * .5, nr * 1.9 + g * .5)]


def build_body(B, p):
    """Shared anatomy driven by the character's proportions in p."""
    hx, hip, knee, ank = p['hx'], p['hip_z'], p['knee_z'], p['ankle_z']
    sx, sh, el, wr = p['sx'], p['shoulder_z'], p['elbow_z'], p['wrist_z']
    pw, pd, ww, wd, nr, belly = p['pw'], p['pd'], p['ww'], p['wd'], p['nr'], p['belly']
    wz, nz = p['waist_z'], p['neck_z']
    zc = p['head_zc']; hrx, hry, hrz = p['head']
    dz = wz - hip
    B.lathe('hips', SKIN, [(hip - 0.09, pw * .62, pd * .62), (hip - 0.05, pw * .88, pd * .9), (hip - 0.0, pw, pd), (hip + dz * .55, (pw * .97 + ww) / 2, (pd + wd) / 2, belly * .5), (wz, ww, wd, belly)], 18, wfn=hips_wfn(p))
    B.lathe('chest', SKIN, chest_rings(p) + [(nz, nr * 1.2, nr * 1.2)], 16, wfn=chest_wfn(p))
    B.lathe('neck', SKIN, [(sh - 0.02, nr * 1.15, nr * 1.15), (zc - hrz * .55, nr, nr)], 12)
    B.lathe('head', SKIN, head_rings(zc, hrx, hry, hrz, p.get("jaw", 0.0), 12), 20)
    t = p['thigh_r']; sr = p['shin_r']; ar = p['arm_r']; fr = p['fore_r']
    hs = p['hand']; fs = p['foot']
    for s, sg in (('L', 1), ('R', -1)):
        if not p.get('legs_covered'):  # skip skin that trousers and boots hide completely
            B.capsule('thigh_' + s, SKIN, sg * hx, 0, hip, knee, t[0], t[1])
            B.capsule('shin_' + s, SKIN, sg * hx, 0, knee, ank, sr[0], sr[1])
        B.sphere('foot_' + s, p.get('foot_cell', SKIN), v(sg * hx, -fs[1] * .35, fs[2] * .95), fs, seg=12, rings=7)
        B.capsule('upper_arm_' + s, SKIN, sg * sx, 0, sh - 0.03, el, ar[0], ar[1])
        B.capsule('forearm_' + s, SKIN, sg * sx, 0, el, wr, fr[0], fr[1])
        # mitten hand with a thumb
        B.sphere('hand_' + s, p.get('hand_cell', SKIN), v(sg * sx, -.005, wr - hs[2] * .75), hs, seg=10, rings=7)
        B.sphere('hand_' + s, p.get('hand_cell', SKIN), v(sg * (sx - hs[0] * .55), -hs[1] * .85, wr - hs[2] * .45), (hs[0] * .42, hs[1] * .45, hs[2] * .52), (0.4 * sg, 0, 0), seg=10, rings=6)


# -- faces ------------------------------------------------------------------

def head_surface(p, ex, ez):
    hrx, hry, hrz = p['head']
    k = max(0.06, 1 - (ex / hrx) ** 2 - (ez / hrz) ** 2)
    return -hry * math.sqrt(k)


def on_face(p, ex, ez, lift=0.0):
    """A point on the front of the head (ex, ez relative to the head centre) and a rotation that
    lays a flat ellipsoid's thin Y axis along the surface normal there."""
    hrx, hry, hrz = p['head']
    zc = p['head_zc']
    y = head_surface(p, ex, ez)
    n = Vector((ex / hrx ** 2, y / hry ** 2, ez / hrz ** 2)).normalized()
    pos = Vector((ex, y, zc + ez)) + n * lift
    rot = n.to_track_quat('-Y', 'Z')
    return pos, rot


def _bent(B, curve, cx, cz, width):
    """Temporarily bend everything added next into a smile (curve > 0) or frown, around (cx, cz)."""
    old = B.tx

    def tx(co):
        dx = (co.x - cx) / max(width, 1e-4)
        co = Vector((co.x, co.y, co.z + curve * width * dx * dx))
        return old(co) if old else co
    B.tx = tx
    return old


def face(B, p, eye_x, eye_z, eye_r, iris_cell=None, lashes=False, nose=.03, nose_z=-.03,
         smile_w=.04, smile_z=-.09, smile_curve=.35, mouth_cell=LIP, blush=True, brow=None):
    """Big glossy chibi eyes, soft nose, little smile, rosy cheeks. Positions are relative to the head
    centre in the head's reference size (the caller sets B.tx to scale the head up)."""
    for sg in (1, -1):
        ex = sg * eye_x
        # layered eye: iris, then a round pupil, then highlights, each clearly in front of the last
        pos, rot = on_face(p, ex, eye_z, .0)
        if iris_cell is not None:
            B.sphere('head', iris_cell, pos, (eye_r[0], .012, eye_r[1]), rot, seg=12, rings=7)
            ppos, _ = on_face(p, ex, eye_z - eye_r[1] * .05, .006)
            B.sphere('head', EYE, ppos, (eye_r[0] * .7, .01, eye_r[1] * .72), rot, seg=12, rings=7)
        else:
            B.sphere('head', EYE, pos, (eye_r[0], .014, eye_r[1]), rot, seg=12, rings=7)
        # two highlights, same side on both eyes so the light reads as one source
        hpos, _ = on_face(p, ex + eye_r[0] * .3, eye_z + eye_r[1] * .36, .016)
        B.sphere('head', EYEHI, hpos, (eye_r[0] * .32, .006, eye_r[0] * .32), rot, seg=10, rings=6)
        hpos, _ = on_face(p, ex - eye_r[0] * .32, eye_z - eye_r[1] * .4, .015)
        B.sphere('head', EYEHI, hpos, (eye_r[0] * .14, .005, eye_r[0] * .14), rot, seg=8, rings=4)
        if lashes:
            # a soft dark lash line hugging the top of the eye, with a little flick at the outer corner
            lpos, lrot = on_face(p, ex, eye_z + eye_r[1] * .78, .008)
            old = _bent(B, -.9, lpos.x, lpos.z, eye_r[0] * 1.05)
            B.sphere('head', EYE, lpos, (eye_r[0] * 1.08, .008, eye_r[1] * .16), lrot, seg=14, rings=5)
            B.tx = old
            fpos, frot = on_face(p, ex + sg * eye_r[0] * .9, eye_z + eye_r[1] * .62, .008)
            B.sphere('head', EYE, fpos, (eye_r[0] * .32, .007, eye_r[1] * .11), frot @ Euler((0, -sg * .7, 0)).to_quaternion(), seg=8, rings=4)
        if brow:
            cell, bw, bh, tilt, bz = brow
            bpos, brot = on_face(p, ex, eye_z + eye_r[1] + bz, .006)
            brot = brot @ Euler((0, -sg * tilt, 0)).to_quaternion()
            B.sphere('head', cell, bpos, (bw, .02, bh), brot, seg=10, rings=6)
        if blush:
            bx = ex * 1.38; bz = eye_z - eye_r[1] * 1.5
            bpos, brot = on_face(p, bx, bz, .001)
            B.sphere('head', BLUSH, bpos, (eye_r[0] * .78, .008, eye_r[1] * .42), brot, seg=10, rings=6)
    if nose:
        npos, nrot = on_face(p, 0, nose_z, nose * .25)
        B.sphere('head', NOSE, npos, (nose * 1.05, nose * .85, nose * .82), nrot, seg=12, rings=8)
    if smile_w:
        mpos, mrot = on_face(p, 0, smile_z, .001)
        old = _bent(B, smile_curve, 0, mpos.z, smile_w)
        B.sphere('head', mouth_cell, mpos, (smile_w, .01, .011), mrot, seg=12, rings=5)
        B.tx = old
