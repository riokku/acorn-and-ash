# Shared building blocks for the Blender art scripts (understory.py, trees.py): a bmesh wrapper that
# carries a vertex colour (and optional UV) per vertex, the soft top-lit shading, and a matte
# material that reads the vertex colours. Colours are stored linear, as glTF expects.
import math
import bpy
import bmesh

SHADE_DOWN, SHADE_UP = .78, 1.08


def hexc(h):
    h = h.lstrip('#')
    # vertex colours are stored linear (as glTF expects), so convert the sRGB hex we picked
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def make_material(name):
    mat = bpy.data.materials.get(name + "_mat") or bpy.data.materials.new(name + "_mat")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Roughness"].default_value = 0.85
    vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    mat.use_backface_culling = False
    return mat


class Piece:
    """A bmesh with a vertex-colour layer; every vertex carries a colour picked when it is made."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.layer = self.bm.loops.layers.color.new("Col")
        self.colour = {}
        self.uv = {}

    def vert(self, p, rgb, uv=None):
        v = self.bm.verts.new(p)
        self.colour[v] = rgb
        if uv is not None:
            self.uv[v] = uv
        return v

    def face(self, verts):
        return self.bm.faces.new(verts)

    def finish(self, collection, mat, shade=True):
        bm = self.bm
        bm.normal_update()
        uv_layer = bm.loops.layers.uv.new("UVMap") if self.uv else None
        for f in bm.faces:
            lit = SHADE_DOWN + (SHADE_UP - SHADE_DOWN) * (f.normal.z * 0.5 + 0.5) if shade else 1.0
            for l in f.loops:
                c = self.colour[l.vert]
                l[self.layer] = (c[0] * lit, c[1] * lit, c[2] * lit, 1.0)
                if uv_layer is not None and l.vert in self.uv:
                    l[uv_layer].uv = self.uv[l.vert]
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(self.name, me)
        collection.objects.link(ob)
        ob.data.materials.append(mat)
        for p in me.polygons:
            p.use_smooth = False
        return ob


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)

