"""
Módulo de gravação de tela e captura de frames de alta performance.
Adaptado e portado de D:/Project_gif/project-gif/src/recorder.py.
"""

import time
from typing import Dict, List
import mss
from PIL import Image


def capture_area(
    area: Dict[str, int],
    duration: float = 2.5,
    fps: int = 15,
) -> List[Image.Image]:
    """
    Captura uma região de tela por um período de tempo a uma taxa de FPS definida.
    Retorna a lista de quadros coletados em memória.
    """
    frame_interval = 1.0 / max(1, fps)
    frames: List[Image.Image] = []

    mss_factory = getattr(mss, "MSS", None) or getattr(mss, "mss")
    with mss_factory() as sct:
        # Valida limites da tela
        monitors = sct.monitors
        primary = monitors[1] if len(monitors) > 1 else monitors[0]

        # Se área não especificada ou zerada, usa monitor principal
        left = area.get("left", primary["left"])
        top = area.get("top", primary["top"])
        width = area.get("width", primary["width"])
        height = area.get("height", primary["height"])

        grab_box = {
            "left": int(left),
            "top": int(top),
            "width": int(width),
            "height": int(height),
        }

        start_time = time.perf_counter()
        end_time = start_time + duration

        while time.perf_counter() < end_time:
            loop_start = time.perf_counter()

            raw_sct = sct.grab(grab_box)
            # Converte BGRA para RGB
            img = Image.frombytes("RGB", raw_sct.size, raw_sct.bgra, "raw", "BGRX")
            frames.append(img)

            elapsed = time.perf_counter() - loop_start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    return frames
