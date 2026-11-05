"""
Entrypoint CLI do Gravador de Tela em GIF para o ThinkRail.
Executa captura programática sem intervenção manual e gera saída JSON padronizada.
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
import mss
from compiler import GifCompiler
from recorder import capture_area


def main():
    parser = argparse.ArgumentParser(
        description="ThinkRail Visual UI GIF Recorder (project-gif core)"
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=2.5,
        help="Duração da gravação em segundos (padrão: 2.5)",
    )
    parser.add_argument(
        "--fps", type=int, default=15, help="Quadros por segundo (padrão: 15)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Caminho do arquivo de saída .gif",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Atraso antes de iniciar a captura em segundos (padrão: 0.5)",
    )
    parser.add_argument(
        "--area",
        type=str,
        default=None,
        help="Área em formato left,top,width,height",
    )
    parser.add_argument(
        "--center",
        type=str,
        default=None,
        help="Captura centralizada em formato width,height (ex: 1200,800)",
    )
    parser.add_argument(
        "--max-colors",
        type=int,
        default=128,
        help="Número máximo de cores na paleta adaptativa (padrão: 128)",
    )

    args = parser.parse_args()

    # Espera atraso inicial se solicitado (útil para foco da janela ou renderização inicial)
    if args.delay > 0:
        time.sleep(args.delay)

    # Determina área de captura
    mss_factory = getattr(mss, "MSS", None) or getattr(mss, "mss")
    with mss_factory() as sct:
        monitors = sct.monitors
        primary = monitors[1] if len(monitors) > 1 else monitors[0]
        screen_w = primary["width"]
        screen_h = primary["height"]
        screen_left = primary["left"]
        screen_top = primary["top"]

    area_box = {
        "left": screen_left,
        "top": screen_top,
        "width": screen_w,
        "height": screen_h,
    }

    if args.area:
        parts = [int(p.strip()) for p in args.area.split(",")]
        if len(parts) == 4:
            area_box = {
                "left": parts[0],
                "top": parts[1],
                "width": parts[2],
                "height": parts[3],
            }
    elif args.center:
        parts = [int(p.strip()) for p in args.center.split(",")]
        if len(parts) == 2:
            w, h = parts[0], parts[1]
            area_box = {
                "left": screen_left + max(0, (screen_w - w) // 2),
                "top": screen_top + max(0, (screen_h - h) // 2),
                "width": min(w, screen_w),
                "height": min(h, screen_h),
            }

    # Define caminho de saída
    if not args.output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = os.path.join(
            ".thinkrail", "context", "visual-reviews", f"ui_review_{timestamp}.gif"
        )

    abs_output = os.path.abspath(args.output)

    try:
        frames = capture_area(area_box, duration=args.duration, fps=args.fps)
        if not frames:
            print(
                json.dumps({
                    "success": False,
                    "error": "Nenhum quadro capturado.",
                })
            )
            sys.exit(1)

        res_path = GifCompiler.compile_gif(
            frames=frames,
            output_path=abs_output,
            target_fps=args.fps,
            max_colors=args.max_colors,
        )

        if not res_path or not os.path.exists(res_path):
            print(
                json.dumps({
                    "success": False,
                    "error": "Falha ao compilar GIF.",
                })
            )
            sys.exit(1)

        size_bytes = os.path.getsize(res_path)
        size_kb = round(size_bytes / 1024, 2)
        first_frame = frames[0]

        result = {
            "success": True,
            "path": res_path.replace("\\", "/"),
            "relativePath": os.path.relpath(res_path, os.getcwd()).replace("\\", "/"),
            "frames": len(frames),
            "durationSeconds": args.duration,
            "fps": args.fps,
            "sizeKb": size_kb,
            "dimensions": {
                "width": first_frame.width,
                "height": first_frame.height,
            },
            "area": area_box,
        }

        print(json.dumps(result, indent=2))

    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
