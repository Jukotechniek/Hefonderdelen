import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from rembg import remove, new_session


def _defringe_rgba(img: Image.Image, threshold: float = 0.98) -> Image.Image:
    """
    Vermindert donkere halo/rand: semi-transparante pixels worden naar wit
    getrokken, zodat de rand zachter en schoner oogt op een witte achtergrond.
    """
    a = np.array(img)
    r, g, b, alpha = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3] / 255.0
    t = np.clip(1 - alpha / max(threshold, 1e-6), 0, 1)
    r = (r * alpha + 255 * (1 - alpha)).astype(np.uint8)
    g = (g * alpha + 255 * (1 - alpha)).astype(np.uint8)
    b = (b * alpha + 255 * (1 - alpha)).astype(np.uint8)
    return Image.fromarray(np.stack([r, g, b, a[:, :, 3]], axis=-1), "RGBA")


def _feather_alpha(img: Image.Image, radius: int = 1) -> Image.Image:
    """Zachte randen: alpha-kanaal licht vervagen tegen jagged edges."""
    if radius <= 0:
        return img
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=float(radius)))
    return Image.merge("RGBA", (r, g, b, a))


def process_one(input_path: Path, output_path: Path, session) -> None:
    with Image.open(input_path).convert("RGBA") as img:
        fg = remove(img, session=session)

    # Randen iets zachter maken (minder kartelig)
    fg = _feather_alpha(fg, radius=1)

    # Defringe: donkere halo bij de rand wordt naar wit getrokken
    fg = _defringe_rgba(fg, threshold=0.92)

    # Witte achtergrond erachter zetten
    white_bg = Image.new("RGBA", fg.size, (255, 255, 255, 255))
    white_bg.paste(fg, mask=fg.split()[3])

    # Opslaan als JPG
    white_bg.convert("RGB").save(output_path, quality=95)


def main() -> int:
    if len(sys.argv) != 3:
        print("Gebruik: python remove_bg.py INPUT_PATH OUTPUT_PATH", file=sys.stderr)
        return 1

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    if not input_path.exists():
        print(f"Input-bestand '{input_path}' bestaat niet.", file=sys.stderr)
        return 1

    try:
        session = new_session("isnet-general-use")
        process_one(input_path, output_path, session)
    except Exception as exc:  # noqa: BLE001
        print(f"Fout tijdens verwerken: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
