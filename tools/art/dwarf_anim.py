# Animation clips for the dwarves. Exec after dwarf_build.py / dwarves_species.py.
# Bone conventions: down-pointing bones swing FORWARD with negative X; character's
# left side is +X, right is -X. Arms abduct with +Z on the right, -Z on the left.
import math
import bpy

FPS = 24
SP = math.sin
CS = math.cos
TAU = 2 * math.pi

STYLE = {
    'dorrin': dict(stride=.9, bounce=1.25, arm_out=.12, swagger=.15),   # sturdy, rolling gait
    'hilde':  dict(stride=1.0, bounce=1.05, arm_out=.09, swagger=.1),   # lighter and bouncier
}


def mir(d):
    """Mirror a left-side pose dict to the right: swap _L/_R, flip Y/Z rotations."""
    out = {}
    for k, val in d.items():
        k2 = k.replace('_L', '_R') if k.endswith('_L') else (k.replace('_R', '_L') if k.endswith('_R') else k)
        out[k2] = (val[0], -val[1], -val[2]) if (k.endswith('_L') or k.endswith('_R')) else val
    return out


def clip_idle(S, tail):
    keys = []
    for f in (0, 18, 36, 54, 72):
        t = TAU * f / 72
        rot = {
            'chest': (.025 * SP(t), .0, 0), 'spine': (.01 * SP(t), 0, 0),
            'head': (-.03 * SP(t) + .02, .14 * SP(t * 1), .03 * SP(t)),
            'upper_arm_L': (.04 * SP(t), 0, -S['arm_out'] - .01 * SP(t)), 'upper_arm_R': (-.04 * SP(t), 0, S['arm_out'] + .01 * SP(t)),
            'forearm_L': (-.14 - .03 * SP(t), 0, 0), 'forearm_R': (-.14 - .03 * SP(t), 0, 0),
            'thigh_L': (0, 0, -.02), 'thigh_R': (0, 0, .02),
        }
        if tail:
            rot['tail_1'] = (0, 0, .12 * SP(t)); rot['tail_2'] = (0, 0, .18 * SP(t - .6)); rot['tail_3'] = (0, 0, .25 * SP(t - 1.2))
        loc = {'hips': (0, -.006 * SP(t * 2), 0)}
        keys.append((f, rot, loc))
    return keys


def _locomotion(S, tail, frames, A, K, B, fore, lean, bob, headlean, tw):
    keys = []
    n = 8
    for i in range(n + 1):
        f = frames * i / n
        ph = TAU * i / n
        thL = -A * SP(ph); thR = A * SP(ph)
        shL = K * max(0, CS(ph)) + .08; shR = K * max(0, -CS(ph)) + .08
        rot = {
            'thigh_L': (thL, 0, -.03), 'thigh_R': (thR, 0, .03),
            'shin_L': (shL, 0, 0), 'shin_R': (shR, 0, 0),
            'foot_L': (-.6 * (thL + shL), 0, 0), 'foot_R': (-.6 * (thR + shR), 0, 0),
            'upper_arm_L': (B * SP(ph), 0, -S['arm_out']), 'upper_arm_R': (-B * SP(ph), 0, S['arm_out']),
            'forearm_L': (fore - .25 * max(0, -SP(ph)) * (1 if fore < -1 else .5), 0, 0), 'forearm_R': (fore - .25 * max(0, SP(ph)) * (1 if fore < -1 else .5), 0, 0),
            'spine': (lean, tw * SP(ph), 0), 'chest': (0, -tw * 1.3 * SP(ph), 0),
            'hips': (0, tw * .6 * SP(ph), .05 * CS(ph)),
            'head': (headlean, tw * .5 * SP(ph), 0),
        }
        if tail:
            rot['tail_1'] = (-lean * .5, 0, .2 * SP(ph)); rot['tail_2'] = (0, 0, .3 * SP(ph - .7)); rot['tail_3'] = (0, 0, .4 * SP(ph - 1.4))
        loc = {'hips': (0, .65 * bob * CS(2 * ph), 0)}
        keys.append((f, rot, loc))
    return keys


def clip_walk(S, tail):
    return _locomotion(S, tail, 24, .55 * S['stride'], 1.0, .5 * S['stride'], -.3, .04, .022 * S['bounce'], -.02, S['swagger'])


def clip_run(S, tail):
    return _locomotion(S, tail, 16, .95 * S['stride'], 1.7, .95 * S['stride'], -1.35, .22, .05 * S['bounce'], -.14, S['swagger'] * 1.2)


def crouch(S, d, tail):
    return {
        'thigh_L': (-.95 * d, 0, -.05), 'thigh_R': (-.95 * d, 0, .05), 'shin_L': (1.7 * d, 0, 0), 'shin_R': (1.7 * d, 0, 0),
        'foot_L': (-.75 * d, 0, 0), 'foot_R': (-.75 * d, 0, 0),
        'spine': (.35 * d, 0, 0), 'head': (-.2 * d, 0, 0),
        'upper_arm_L': (.9 * d, 0, -S['arm_out']), 'upper_arm_R': (.9 * d, 0, S['arm_out']),
        'forearm_L': (-.3, 0, 0), 'forearm_R': (-.3, 0, 0),
    }


def clip_jump(S, tail, S_hip=.8):
    hdrop = -.13
    ex = {}
    keys = []
    c = crouch(S, 1.0, tail)
    keys.append((0, {'upper_arm_L': (0, 0, -S['arm_out']), 'upper_arm_R': (0, 0, S['arm_out']), 'forearm_L': (-.15, 0, 0), 'forearm_R': (-.15, 0, 0)}, {}))
    keys.append((6, c, {'hips': (0, hdrop * S_hip, 0)}))
    air = {
        'thigh_L': (-.55, 0, -.06), 'thigh_R': (-.3, 0, .06), 'shin_L': (.9, 0, 0), 'shin_R': (.6, 0, 0),
        'foot_L': (.2, 0, 0), 'foot_R': (.2, 0, 0), 'spine': (-.05, 0, 0),
        'upper_arm_L': (-.5, 0, -2.5), 'upper_arm_R': (-.5, 0, 2.5), 'forearm_L': (-.3, 0, 0), 'forearm_R': (-.3, 0, 0), 'head': (-.1, 0, 0),
    }
    keys.append((11, {**air, 'thigh_L': (-.1, 0, -.04), 'thigh_R': (-.1, 0, .04), 'shin_L': (.1, 0, 0), 'shin_R': (.1, 0, 0), 'foot_L': (.5, 0, 0), 'foot_R': (.5, 0, 0)}, {'root': (0, .1, 0)}))
    keys.append((16, air, {'root': (0, .25, 0)}))
    fall = {**air, 'thigh_L': (-.35, 0, -.06), 'thigh_R': (-.2, 0, .06), 'shin_L': (.35, 0, 0), 'shin_R': (.25, 0, 0), 'upper_arm_L': (-.3, 0, -1.7), 'upper_arm_R': (-.3, 0, 1.7)}
    keys.append((22, fall, {'root': (0, .13, 0)}))
    keys.append((27, crouch(S, .85, tail), {'hips': (0, hdrop * .75 * S_hip, 0)}))
    keys.append((34, {'upper_arm_L': (0, 0, -S['arm_out']), 'upper_arm_R': (0, 0, S['arm_out']), 'forearm_L': (-.15, 0, 0), 'forearm_R': (-.15, 0, 0)}, {}))
    if tail:
        for i, (f, r, l) in enumerate(keys):
            r['tail_1'] = (-.2 if 8 < f < 24 else .1, 0, 0); r['tail_2'] = (-.25 if 8 < f < 24 else .1, 0, 0)
    return keys


def clip_wave(S, tail):
    keys = []
    for f in (0, 8, 14, 20, 26, 32, 40, 48):
        ramp = min(1, f / 8) if f <= 40 else (48 - f) / 8
        t = TAU * (f - 8) / 12
        w = SP(t) if 8 <= f <= 40 else 0
        rot = {
            'upper_arm_R': (-.2 * ramp, 0, (2.55) * ramp + S['arm_out'] * (1 - ramp)),
            'forearm_R': (-.1 * ramp, 0, (.35 + .45 * w) * ramp),
            'hand_R': (0, 0, .25 * w * ramp),
            'upper_arm_L': (0, 0, -S['arm_out']), 'forearm_L': (-.15, 0, 0),
            'head': (-.05 * ramp, -.05 * ramp, -.14 * ramp), 'chest': (0, 0, -.06 * ramp), 'spine': (0, 0, -.04 * ramp),
        }
        if tail:
            rot['tail_1'] = (0, 0, .35 * SP(t)); rot['tail_2'] = (0, 0, .4 * SP(t - .8)); rot['tail_3'] = (0, 0, .45 * SP(t - 1.6))
        keys.append((f, rot, {'hips': (0, -.005, 0)}))
    return keys


def clip_chop(S, tail):
    ready = {
        'upper_arm_R': (-1.1, 0, .12), 'forearm_R': (-.55, 0, 0), 'upper_arm_L': (-.7, 0, -.15), 'forearm_L': (-.9, 0, 0),
        'spine': (.05, 0, 0), 'thigh_L': (-.12, 0, -.08), 'thigh_R': (.12, 0, .08), 'shin_L': (.12, 0, 0), 'shin_R': (.12, 0, 0),
    }
    wind = {
        'upper_arm_R': (-2.85, 0, .12), 'forearm_R': (-.6, 0, 0), 'upper_arm_L': (-2.4, 0, -.15), 'forearm_L': (-.7, 0, 0),
        'spine': (-.18, 0, 0), 'chest': (-.1, 0, 0), 'head': (.12, 0, 0),
        'thigh_L': (-.25, 0, -.08), 'thigh_R': (.15, 0, .08), 'shin_L': (.25, 0, 0), 'shin_R': (.15, 0, 0),
    }
    hit = {
        'upper_arm_R': (-.7, 0, .12), 'forearm_R': (-.2, 0, 0), 'upper_arm_L': (-.6, 0, -.15), 'forearm_L': (-.45, 0, 0),
        'spine': (.5, 0, 0), 'chest': (.1, 0, 0), 'head': (-.25, 0, 0),
        'thigh_L': (-.6, 0, -.08), 'thigh_R': (.2, 0, .08), 'shin_L': (.8, 0, 0), 'shin_R': (.35, 0, 0), 'foot_L': (-.3, 0, 0),
    }
    keys = [(0, ready, {}), (9, wind, {'hips': (0, .01, 0)}), (13, hit, {'hips': (0, -.09, 0)}), (17, {**hit, 'spine': (.52, 0, 0)}, {'hips': (0, -.09, 0)}),
            (27, ready, {}), (36, ready, {})]
    if tail:
        for f, r, l in keys:
            r['tail_1'] = (-.3 if f == 13 else 0, 0, 0)
    return keys


def clip_sit(S, tail, p):
    # Sitting on a low stool: thighs tilt a little below level and splay apart, so the chunky
    # thighs don't swing up through the belt or tunic hem. Shins stay upright, feet flat.
    lift, splay = 1.2, .24
    thigh_len, shin_len = p['hip_z'] - p['knee_z'], p['knee_z'] - p['ankle_z']
    drop = -(p['hip_z'] - (p['ankle_z'] + shin_len + thigh_len * math.cos(lift)))
    keys = []
    for f in (0, 18, 36, 54, 72):
        t = TAU * f / 72
        rot = {
            'thigh_L': (-lift, 0, -splay), 'thigh_R': (-lift, 0, splay), 'shin_L': (lift, 0, splay * .8), 'shin_R': (lift, 0, -splay * .8),
            'upper_arm_L': (-.5, 0, -.2), 'upper_arm_R': (-.5, 0, .2), 'forearm_L': (-.85, 0, 0), 'forearm_R': (-.85, 0, 0),
            'spine': (.04 + .015 * SP(t), 0, 0), 'chest': (.03 * SP(t), 0, 0), 'head': (-.05, .3 * SP(t), 0),
        }
        if tail:
            rot['tail_1'] = (.35, 0, .12 * SP(t)); rot['tail_2'] = (.2, 0, .18 * SP(t - .7)); rot['tail_3'] = (0, 0, .25 * SP(t - 1.4))
        keys.append((f, rot, {'hips': (0, drop, 0)}))
    return keys


def clip_sleep(S, tail, p):
    keys = []
    for f in (0, 24, 48, 72, 96):
        t = TAU * f / 96
        rot = {
            'root': (-math.pi / 2, 0, 0),
            'chest': (-.03 * SP(t), 0, 0), 'head': (.05, 0, .35), 'thigh_L': (0, 0, -.12), 'thigh_R': (0, 0, .12),
            'upper_arm_L': (0, 0, -.22), 'upper_arm_R': (0, 0, .22), 'forearm_L': (-.12, 0, 0), 'forearm_R': (-.12, 0, 0),
            'foot_L': (.5, 0, .15), 'foot_R': (.5, 0, -.15),
        }
        if tail:
            rot['tail_1'] = (.2, 0, .5); rot['tail_2'] = (.1, 0, .7); rot['tail_3'] = (0, 0, .6)
        keys.append((f, rot, {'root': (0, p['pd'] + .06, 0)}))
    return keys


def add_clip(arm, race, name, keys, G=1.0):
    act = bpy.data.actions.new(f"{race}_{name}")
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    for f, rot, loc in keys:
        for pb in arm.pose.bones:
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = rot.get(pb.name, (0, 0, 0))
            pb.location = tuple(c * G for c in loc.get(pb.name, (0, 0, 0)))
            pb.keyframe_insert('rotation_euler', frame=f)
            pb.keyframe_insert('location', frame=f)
    start = int(min(k[0] for k in keys))
    arm.animation_data.action = None
    tr = arm.animation_data.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, start, act)
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
    return act


def animate_all(chars, specs):
    sc = bpy.context.scene
    sc.render.fps = FPS
    for sp, *_ in specs:
        tail = False
        race = sp['name']
        arm = chars[race][0]
        if arm.animation_data:
            for t in list(arm.animation_data.nla_tracks):
                arm.animation_data.nla_tracks.remove(t)
        S = STYLE.get(race, dict(stride=.95, bounce=1.1, arm_out=.1, swagger=.12))
        G = sp.get('G', 1.0)
        add_clip(arm, race, 'idle', clip_idle(S, tail), G)
        add_clip(arm, race, 'walk', clip_walk(S, tail), G)
        add_clip(arm, race, 'run', clip_run(S, tail), G)
        add_clip(arm, race, 'jump', clip_jump(S, tail), G)
        add_clip(arm, race, 'wave', clip_wave(S, tail), G)
        add_clip(arm, race, 'chop', clip_chop(S, tail), G)
        add_clip(arm, race, 'sit', clip_sit(S, tail, sp), G)
        add_clip(arm, race, 'sleep', clip_sleep(S, tail, sp), G)


def solo(arm, name):
    for tr in arm.animation_data.nla_tracks:
        tr.mute = (tr.name != name)
