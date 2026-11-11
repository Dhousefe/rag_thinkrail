"""Create a selective payload for NSIS offline full-bundle installer.
Copies only required artifacts to avoid recursion, long paths, and reduce size.
"""
import os, shutil
src_root = r'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist'
dst_root = r'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist\gui-installer\packager\nsis\payload'
# Files/dirs to include (relative to src_root)
include = [
    'germes.exe',
    'germes.jar',
    'thinkrail.exe',
    'hermes.properties',
    'models\jina-code-onnx',
    'libs\windows\x64',
    'embeddings-api',
    'scripts',
    'tools',
    'start_embeddings.bat',
    'start_embeddings.sh',
    'setup-ambiente.bat',
    'setup-ambiente.sh',
    'LICENSES.txt',
    'README-distribution.md',
    'README_DISTRIBUICAO.md',
    'RELEASE_MANIFEST.json',
]
# Ensure destination exists
if os.path.exists(dst_root):
    print('Removing existing payload at', dst_root)
    shutil.rmtree(dst_root)

os.makedirs(dst_root, exist_ok=True)

for item in include:
    s = os.path.join(src_root, item)
    if not os.path.exists(s):
        print('WARN: missing', s)
        continue
    if os.path.isdir(s):
        dest = os.path.join(dst_root, os.path.basename(item))
        print('Copying dir', s, '->', dest)
        shutil.copytree(s, dest)
    else:
        dest = os.path.join(dst_root, os.path.basename(item))
        print('Copying file', s, '->', dest)
        shutil.copy2(s, dest)

print('Selective payload creation complete')
