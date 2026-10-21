"""Copia el proyecto al repositorio público de GitHub SIN las imágenes de referencia
(el trazado y las capturas del usuario son privadas) y hace un commit.

Uso: python3 tools/publicar_github.py /ruta/al/clon "mensaje"
"""
import os, re, shutil, subprocess, sys

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST, MSG = sys.argv[1], sys.argv[2]
PRIVADO = re.compile(r"^(public/referencias/.*\.(jpe?g|png)|docs/RECUPERACION\.md)$", re.I)

def ls(repo):
    out = subprocess.run(["git", "-C", repo, "ls-files", "-z"], capture_output=True, check=True).stdout.decode()
    return {f for f in out.split("\0") if f}

src_files = {f for f in ls(SRC) if not PRIVADO.match(f)}
for f in src_files:
    os.makedirs(os.path.dirname(os.path.join(DST, f)) or DST, exist_ok=True)
    shutil.copy2(os.path.join(SRC, f), os.path.join(DST, f))
for f in ls(DST) - src_files:
    os.remove(os.path.join(DST, f))
subprocess.run(["git", "-C", DST, "add", "-A"], check=True)
r = subprocess.run(["git", "-C", DST, "commit", "-q", "-m", MSG])
print("commit hecho" if r.returncode == 0 else "sin cambios")
