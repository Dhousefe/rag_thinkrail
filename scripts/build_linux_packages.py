import os, shutil, tarfile, tempfile, time, subprocess
from pathlib import Path

ROOT = Path(r'D:/Projet_Thinkrail/source/thinkrail/apps/cli/dist')
PAYLOAD = ROOT / 'gui-installer' / 'packager' / 'nsis' / 'payload'
RELEASES = ROOT / 'releases'
RELEASES.mkdir(parents=True, exist_ok=True)

VERSION = '0.1'
PKGNAME = 'hermes-rag'
ARCH = 'amd64'

# 1) create tar.gz
tar_path = RELEASES / f'{PKGNAME}-{VERSION}-linux.tar.gz'
print('Creating tar.gz:', tar_path)
with tarfile.open(tar_path, 'w:gz') as tar:
    # Put payload contents at root of tar
    if not PAYLOAD.exists():
        raise SystemExit('Payload not found: ' + str(PAYLOAD))
    for p in PAYLOAD.rglob('*'):
        arcname = p.relative_to(PAYLOAD)
        tar.add(p, arcname=arcname)
print('Tar created')

# 2) create .deb by building data.tar.gz and control.tar.gz and ar packaging
# Force temporary working directory on D: to avoid system C: low-space issues
tmp_root = Path(r'D:/Projet_Thinkrail/source/thinkrail/staging/deb_tmp')
shutil.rmtree(tmp_root, ignore_errors=True)
tmp_root.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(dir=str(tmp_root)) as tmpd:
    tmp = Path(tmpd)
    data_dir = tmp / 'data'
    data_opt = data_dir / 'opt' / PKGNAME
    data_opt.mkdir(parents=True)
    # copy payload into data/opt/hermes-rag
    print('Copying payload to deb data dir...')
    def _copytree(src, dst):
        src = Path(src)
        for p in src.rglob('*'):
            rel = p.relative_to(src)
            target = dst / rel
            if p.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, target)
    _copytree(PAYLOAD, data_opt)

    # create simple postinst to create user dirs and systemd unit if present
    etc_systemd = data_dir / 'lib' / 'systemd' / 'system'
    etc_systemd.mkdir(parents=True, exist_ok=True)
    # include systemd unit if exists in ROOT/systemd
    systemd_src = ROOT / 'systemd' / 'hermes.service'
    if systemd_src.exists():
        shutil.copy2(systemd_src, etc_systemd / 'hermes.service')

    # create DEBIAN control
    debian_dir = tmp / 'DEBIAN'
    debian_dir.mkdir()
    control = f"Package: {PKGNAME}\nVersion: {VERSION}\nSection: utils\nPriority: optional\nArchitecture: {ARCH}\nDepends: python3, openjdk-17 | openjdk-11\nMaintainer: ThinkRail <noreply@example.com>\nDescription: Hermes RAG distribution - runtime, model and helpers\n"
    (debian_dir / 'control').write_text(control)

    # optional postinst
    postinst = "#!/bin/sh\nset -e\n# create per-user default projects dir under /opt/hermes-rag for system users\nmkdir -p /opt/hermes-rag/data\nexit 0\n"
    (debian_dir / 'postinst').write_text(postinst)
    os.chmod(debian_dir / 'postinst', 0o755)

    # build data.tar.gz
    data_tar = tmp / 'data.tar.gz'
    with tarfile.open(data_tar, 'w:gz') as tar:
        # add contents of data_dir with correct root
        for p in data_dir.rglob('*'):
            tar.add(p, arcname=str(p.relative_to(data_dir)))
    # build control.tar.gz
    control_tar = tmp / 'control.tar.gz'
    with tarfile.open(control_tar, 'w:gz') as tar:
        for p in debian_dir.rglob('*'):
            tar.add(p, arcname=str(p.relative_to(debian_dir)))
    # debian-binary
    debbin = tmp / 'debian-binary'
    debbin.write_text('2.0\n')

    # assemble ar archive (.deb)
    deb_path = RELEASES / f'{PKGNAME}_{VERSION}_{ARCH}.deb'
    print('Assembling deb:', deb_path)
    # Minimal ar packing implementation
    def write_ar_member(f, name, data_path):
        st = data_path.stat()
        mtime = int(st.st_mtime)
        uid = 0
        gid = 0
        mode = 0o100644
        size = data_path.stat().st_size
        header = f"{name}/".ljust(16) + str(mtime).rjust(12) + str(uid).rjust(6) + str(gid).rjust(6) + oct(mode)[2:].rjust(8) + str(size).rjust(10) + "`\n"
        f.write(header.encode('utf-8'))
        with open(data_path, 'rb') as r:
            shutil.copyfileobj(r, f)
        if (size % 2) == 1:
            f.write(b'\n')

    with open(deb_path, 'wb') as out:
        out.write(b'!<arch>\n')
        write_ar_member(out, 'debian-binary', debbin)
        write_ar_member(out, 'control.tar.gz', control_tar)
        write_ar_member(out, 'data.tar.gz', data_tar)

    print('DEB created at', deb_path)

print('All packages created under', RELEASES)
