"""Finish tree bark in Blender: weld UV seam positions and keep side lighting continuous."""
import bmesh


def polish_bark(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    # UVs belong to face corners, so welding positions preserves the texture wrap.
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    for face in bm.faces:
        face.smooth = len(face.verts) == 4
    assert all(edge.is_manifold for edge in bm.edges), f'{ob.name}: open bark seam or cap'
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
