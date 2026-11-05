"""
Módulo de compilação e quantização de GIFs de alta eficiência para o ThinkRail.
Adaptado e portado de D:/Project_gif/project-gif/src/gif_compiler.py.
"""

import os
from datetime import datetime
from typing import List, Optional
from PIL import Image


class GifCompiler:
    """
    Compila uma sequência de imagens PIL em um arquivo GIF leve e otimizado
    para consumo multimodal por LLMs (Vision/Attachments).
    """

    @staticmethod
    def compile_gif(
        frames: List[Image.Image],
        output_path: str,
        target_fps: int = 15,
        max_colors: int = 128,
    ) -> Optional[str]:
        if not frames:
            return None

        out_dir = os.path.dirname(os.path.abspath(output_path))
        os.makedirs(out_dir, exist_ok=True)

        duration_ms = max(20, int(1000 / target_fps))

        # Redimensiona se algum frame for muito grande (> 1280px de largura) para economia de tokens no provider
        first_w, first_h = frames[0].size
        max_dim = 1280
        scale = 1.0
        if max(first_w, first_h) > max_dim:
            scale = max_dim / max(first_w, first_h)
            new_size = (int(first_w * scale), int(first_h * scale))
            frames = [f.resize(new_size, Image.Resampling.LANCZOS) for f in frames]

        # 1. Cria paleta global adaptativa compartilhada
        master_palette = frames[0].quantize(
            colors=max_colors, method=Image.Resampling.LANCZOS
        )

        # 2. Quantiza todos os frames usando Dither.NONE (evita ruído LZW e gera arquivo ultraleve)
        quantized_frames = [
            f.quantize(palette=master_palette, dither=Image.Dither.NONE) for f in frames
        ]

        # 3. Salva com otimização ativada e loop infinito
        quantized_frames[0].save(
            output_path,
            save_all=True,
            append_images=quantized_frames[1:],
            optimize=True,
            duration=duration_ms,
            loop=0,
        )

        return output_path
