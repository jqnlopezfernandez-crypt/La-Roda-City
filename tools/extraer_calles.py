"""
Extrae el grafo de calles del trazado original del usuario.

Entrada : public/referencias/trazado-fondo-negro-original.jpeg  (no se modifica)
Salida  : shared/map/streets.generated.json
          public/referencias/_extraccion-calles.png   (imagen de revisión)

Todas las coordenadas de salida están en PÍXELES DEL TRAZADO ORIGINAL (1100x1081).
El juego las multiplica por una escala uniforme; ningún punto se mueve a mano.

Pasos:
 1. Trazo = píxeles claros (blanco y gris). Se ignora la mancha azul de la esquina
    superior derecha (artefacto de la captura, no es calle).
 2. Los puntos rojos pintados ENCIMA de una calle cortan el trazo. Se rellenan solo
    los píxeles rojos que quedan entre trazos (cierre morfológico limitado a rojo).
 3. Esqueleto de 1 px -> grafo: nodos = cruces y extremos; aristas = tramos.
 4. Se eliminan "flecos" de esqueletización (ramas sueltas < MIN_SPUR px), que no
    son calles sino el grosor del lápiz en las esquinas.
 5. Cada tramo se simplifica con Ramer-Douglas-Peucker (tolerancia 1,2 px) para
    quitar los escalones de píxel y se suaviza con Chaikin (los extremos y cruces
    no se mueven). Se comprueba que la línea sigue dentro del trazo original.
 6. Se mide el error: distancia de la línea central al trazo original y viceversa.
"""
import json, os, sys, math
import numpy as np, cv2
from scipy import ndimage as ndi
from skimage.morphology import skeletonize, disk

def binary_closing(m, se):
    return ndi.binary_closing(np.pad(m, 10), structure=se, iterations=1)[10:-10, 10:-10]

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "public", "referencias", "trazado-fondo-negro-original.jpeg")
OUT_JSON = os.path.join(ROOT, "shared", "map", "streets.generated.json")
OUT_PNG = os.path.join(ROOT, "public", "referencias", "_extraccion-calles.png")
MIN_SPUR = 10      # px: ramas sueltas más cortas se consideran grosor del trazo
RDP_TOL = 1.2      # px
PATIO_INSET = 10   # px: media calle (4,5) + fondo de las casas (5,5). Solo decorativo.
CHAIKIN_ITER = 3   # suavizado de esquinas (solo redondea vértices; se mide abajo)

img = cv2.imread(SRC)
H, W = img.shape[:2]
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
light = img.min(axis=2) > 150                     # blanco y gris claro
blue = (hsv[..., 0] > 90) & (hsv[..., 0] < 130) & (hsv[..., 1] > 40)
light[:70, 980:] = False                          # artefacto azul esquina sup. dcha.
red = ((hsv[..., 0] < 12) | (hsv[..., 0] > 168)) & (hsv[..., 1] > 90) & (hsv[..., 2] > 90)

# limpiar motas sueltas (compresión JPEG)
lab, n = ndi.label(light, structure=np.ones((3, 3)))
sizes = ndi.sum(light, lab, range(1, n + 1))
light = np.isin(lab, 1 + np.nonzero(sizes >= 200)[0])

# solo el rojo que queda ENTRE trazos claros (punto pintado sobre la calle);
# los números escritos al lado no se tocan
bridge = binary_closing(light, disk(7))
stroke = light | (red & bridge)
stroke = binary_closing(stroke, disk(2))

sk = skeletonize(stroke)
K = np.ones((3, 3), int); K[1, 1] = 0

def neighbors(y, x):
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if (dy or dx) and 0 <= y + dy < H and 0 <= x + dx < W and sk[y + dy, x + dx]:
                yield (y + dy, x + dx)

def build_graph(sk):
    deg = ndi.convolve(sk.astype(int), K, mode="constant") * sk
    nodemask = sk & (deg != 2)
    nl, nn = ndi.label(nodemask, structure=np.ones((3, 3)))
    centers = ndi.center_of_mass(nodemask, nl, range(1, nn + 1))
    node_of = {}
    for y, x in zip(*np.nonzero(nl)):
        node_of[(y, x)] = nl[y, x] - 1
    nodes = [(float(c[1]), float(c[0])) for c in centers]
    visited = set()
    edges = []
    for start, nid in list(node_of.items()):
        for nb in neighbors(*start):
            if nb in node_of:
                continue
            if (start, nb) in visited:
                continue
            path = [start, nb]
            prev, cur = start, nb
            while cur not in node_of:
                nxt = [p for p in neighbors(*cur) if p != prev and p not in path[-3:]]
                if not nxt:
                    break
                # preferir el vecino que es nodo si existe
                nodes_n = [p for p in nxt if p in node_of]
                prev, cur = cur, (nodes_n[0] if nodes_n else nxt[0])
                path.append(cur)
            if cur not in node_of:
                continue
            visited.add((start, path[1])); visited.add((cur, path[-2]))
            edges.append({"a": nid, "b": node_of[cur], "px": [(x, y) for y, x in path]})
    # nodos adyacentes directamente (sin píxeles intermedios) no generan arista: están fusionados por label
    return nodes, edges, deg

nodes, edges, deg = build_graph(sk)

def length(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))

# grado de cada nodo
def degrees(edges, n):
    d = [0] * n
    for e in edges:
        d[e["a"]] += 1; d[e["b"]] += 1
    return d

removed_spurs = []
changed = True
while changed:
    changed = False
    d = degrees(edges, len(nodes))
    keep = []
    for e in edges:
        L = length(e["px"])
        leaf = (d[e["a"]] == 1) != (d[e["b"]] == 1)  # exactamente un extremo suelto
        if leaf and L < MIN_SPUR:
            removed_spurs.append({"len": round(L, 1), "at": e["px"][0]})
            changed = True
            continue
        keep.append(e)
    edges = keep

# fusionar cadenas a través de nodos de grado 2 (quedan tras quitar flecos)
def merge_deg2(nodes, edges):
    while True:
        d = degrees(edges, len(nodes))
        target = next((i for i, v in enumerate(d) if v == 2 and not any(e["a"] == e["b"] == i for e in edges)), None)
        if target is None:
            return edges
        es = [e for e in edges if e["a"] == target or e["b"] == target]
        e1, e2 = es
        p1 = e1["px"] if e1["b"] == target else e1["px"][::-1]
        p2 = e2["px"] if e2["a"] == target else e2["px"][::-1]
        a = e1["a"] if e1["b"] == target else e1["b"]
        b = e2["b"] if e2["a"] == target else e2["a"]
        new = {"a": a, "b": b, "px": p1 + p2[1:]}
        edges = [e for e in edges if e is not e1 and e is not e2] + [new]

edges = merge_deg2(nodes, edges)

def rdp(pts, eps):
    pts = np.asarray(pts, float)
    if len(pts) < 3:
        return pts.tolist()
    a, b = pts[0], pts[-1]
    ab = b - a
    nrm = np.hypot(*ab)
    if nrm == 0:
        dists = np.hypot(*(pts - a).T)
    else:
        dists = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / nrm
    i = int(np.argmax(dists))
    if dists[i] > eps:
        return rdp(pts[: i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [a.tolist(), b.tolist()]

def chaikin(pts, n):
    pts = [tuple(p) for p in pts]
    for _ in range(n):
        if len(pts) < 3:
            return [list(p) for p in pts]
        out = [pts[0]]
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            q = (0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1)
            r = (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)
            if i > 0:
                out.append(q)
            if i < len(pts) - 2:
                out.append(r)
        out.append(pts[-1])
        pts = out
    return [list(p) for p in pts]

def smooth_keep_corners(pts, max_turn_deg=55):
    """Chaikin por tramos, sin redondear las esquinas cerradas del dibujo."""
    cuts = [0]
    for i in range(1, len(pts) - 1):
        a = np.subtract(pts[i], pts[i - 1]); b = np.subtract(pts[i + 1], pts[i])
        cosang = np.dot(a, b) / (np.hypot(*a) * np.hypot(*b) + 1e-9)
        if math.degrees(math.acos(max(-1, min(1, cosang)))) > max_turn_deg:
            cuts.append(i)
    cuts.append(len(pts) - 1)
    out = []
    for s0, s1 in zip(cuts, cuts[1:]):
        part = chaikin(pts[s0:s1 + 1], CHAIKIN_ITER)
        out.extend(part if not out else part[1:])
    return rdp(out, 0.15)

used = sorted({e["a"] for e in edges} | {e["b"] for e in edges})
remap = {old: new for new, old in enumerate(used)}
out_nodes = []
for old in used:
    out_nodes.append({"id": remap[old], "x": round(nodes[old][0], 1), "y": round(nodes[old][1], 1)})
d = degrees(edges, len(nodes))
for nd, old in zip(out_nodes, used):
    nd["kind"] = "extremo" if d[old] == 1 else "cruce"

out_edges = []
center = np.zeros((H, W), np.uint8)
for i, e in enumerate(sorted(edges, key=lambda e: (e["px"][0][1], e["px"][0][0]))):
    pts = e["px"]
    # anclar extremos al centro de su nodo
    pts = [nodes[e["a"]]] + pts[1:-1] + [nodes[e["b"]]]
    simp = rdp(pts, RDP_TOL)
    simp = smooth_keep_corners(simp)
    cv2.polylines(center, [np.round(np.array(simp)).astype(np.int32)], False, 255, 1)
    # tono del trazo original: gris (calles interiores) o blanco
    ys = np.clip(np.round([p[1] for p in e["px"]]).astype(int), 0, H - 1)
    xs = np.clip(np.round([p[0] for p in e["px"]]).astype(int), 0, W - 1)
    tone = float(np.median(img[ys, xs].min(axis=1)))
    out_edges.append({
        "id": i, "a": remap[e["a"]], "b": remap[e["b"]],
        "length": round(length(simp), 1),
        "trazo": "gris" if tone < 225 else "blanco",
        "points": [[round(p[0], 1), round(p[1], 1)] for p in simp],
    })

# --- verificación ---
dt_center = cv2.distanceTransform((center == 0).astype(np.uint8), cv2.DIST_L2, 5)
dt_stroke = cv2.distanceTransform((~light).astype(np.uint8), cv2.DIST_L2, 5)
err_stroke_to_center = dt_center[light]           # trazo original -> línea central
cy, cx = np.nonzero(center)
err_center_in_stroke = dt_stroke[cy, cx]          # línea central -> trazo original
stroke_w = 2 * cv2.distanceTransform(stroke.astype(np.uint8), cv2.DIST_L2, 5)[sk]
uncovered = light & (dt_center > 6)
ul, un = ndi.label(uncovered, structure=np.ones((3, 3)))
uncovered_blobs = [s for s in ndi.sum(uncovered, ul, range(1, un + 1)) if s > 15]

report = {
    "trazo_px_cubiertos_por_linea_central_p50": round(float(np.median(err_stroke_to_center)), 2),
    "trazo_px_cubiertos_p99": round(float(np.percentile(err_stroke_to_center, 99)), 2),
    "linea_central_fuera_del_trazo_p99": round(float(np.percentile(err_center_in_stroke, 99)), 2),
    "linea_central_fuera_del_trazo_max": round(float(err_center_in_stroke.max()), 2),
    "grosor_trazo_mediana": round(float(np.median(stroke_w)), 1),
    "zonas_de_trazo_sin_calle": len(uncovered_blobs),
    "flecos_eliminados": len(removed_spurs),
}
# --- manzanas: caras cerradas del grafo de calles (delimitadas por las líneas centrales) ---
# Se rasteriza la red de líneas centrales a 4x y se buscan las regiones cerradas.
# Así el contorno de cada manzana coincide exactamente con el eje de sus calles.
SS = 4
net = np.zeros((H * SS, W * SS), np.uint8)
for e in out_edges:
    cv2.polylines(net, [np.round(np.array(e["points"]) * SS).astype(np.int32)], False, 255, 2, cv2.LINE_8)
holes = net == 0
hl, hn = ndi.label(holes)
border = set(np.unique(np.r_[hl[0], hl[-1], hl[:, 0], hl[:, -1]]))
blocks = []
for i in range(1, hn + 1):
    if i in border:
        continue
    m = (hl == i).astype(np.uint8)
    area = int(m.sum()) / (SS * SS)
    if area < 4:
        continue
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    poly = cv2.approxPolyDP(c, 0.5 * SS, True)[:, 0, :].astype(float) / SS
    inner = cv2.distanceTransform(m, cv2.DIST_L2, 5)
    # patios: interior de la manzana a más de PATIO_INSET px del eje de la calle
    patios = []
    pm = (inner > PATIO_INSET * SS).astype(np.uint8)
    pcs, _ = cv2.findContours(pm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    for pc in pcs:
        if cv2.contourArea(pc) < (3 * SS) ** 2:
            continue
        pp = cv2.approxPolyDP(pc, 0.6 * SS, True)[:, 0, :].astype(float) / SS
        patios.append([[round(float(x), 2), round(float(y), 2)] for x, y in pp])
    blocks.append({"id": len(blocks), "area": round(area), "patios": patios,
                   # ancho entre ejes de calle; el ancho libre real es este menos el ancho de calle
                   "anchoMax": round(float(2 * inner.max()) / SS, 1),
                   "points": [[round(float(x), 2), round(float(y), 2)] for x, y in poly]})
blocks.sort(key=lambda b: -b["area"])
for k, b in enumerate(blocks):
    b["id"] = k
report["manzanas_cerradas"] = len(blocks)

lab2, ncomp = ndi.label(center > 0, structure=np.ones((3, 3)))
report["piezas_conectadas"] = int(ncomp)

data = {
    "_aviso": "GENERADO por tools/extraer_calles.py a partir del trazado del usuario. No editar a mano: corregir con overrides en streetOverrides.ts.",
    "source": "public/referencias/trazado-fondo-negro-original.jpeg",
    "sourceSize": [W, H],
    "units": "pixeles del trazado original",
    "toMapScreenshot": {"dx": 744, "dy": 160, "scale": 1.0, "nota": "medido en tools/comprobar_alineacion.py"},
    "rdpTolerance": RDP_TOL,
    "report": report,
    "nodes": out_nodes,
    "edges": out_edges,
    "blocks": blocks,
}
os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=1)

# imagen de revisión
vis = (img * 0.45).astype(np.uint8)
for e in out_edges:
    col = (255, 200, 0) if e["trazo"] == "blanco" else (0, 200, 255)
    cv2.polylines(vis, [np.round(np.array(e["points"])).astype(np.int32)], False, col, 2, cv2.LINE_AA)
for nd in out_nodes:
    c = (0, 255, 0) if nd["kind"] == "cruce" else (0, 0, 255)
    cv2.circle(vis, (int(nd["x"]), int(nd["y"])), 4, c, -1)
    cv2.putText(vis, str(nd["id"]), (int(nd["x"]) + 5, int(nd["y"]) - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)
for b in blocks:
    cv2.polylines(vis, [np.round(np.array(b["points"])).astype(np.int32)], True, (80, 80, 255), 1, cv2.LINE_AA)
cv2.imwrite(OUT_PNG, vis)
print(json.dumps(report, indent=1, ensure_ascii=False))
print("nodos", len(out_nodes), "tramos", len(out_edges), "extremos", sum(n["kind"] == "extremo" for n in out_nodes))
