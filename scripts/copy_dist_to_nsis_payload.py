import shutil, os
src = r'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist'
dst = r'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist\gui-installer\packager\nsis\payload'
# Avoid copying payload into itself
exclude_prefix = os.path.normpath(dst)
if os.path.exists(dst):
    print('Removing existing dst', dst)
    shutil.rmtree(dst)
os.makedirs(dst)
for root, dirs, files in os.walk(src):
    # skip recursion into payload if encountered
    normroot = os.path.normpath(root)
    if normroot.startswith(exclude_prefix):
        continue
    rel = os.path.relpath(root, src)
    target_dir = os.path.join(dst, rel) if rel != '.' else dst
    os.makedirs(target_dir, exist_ok=True)
    for f in files:
        s = os.path.join(root, f)
        t = os.path.join(target_dir, f)
        try:
            shutil.copy2(s, t)
        except Exception as e:
            print('ERROR copying', s, '->', t, e)
print('copy complete')
