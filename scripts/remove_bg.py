import sys
from pathlib import Path

from PIL import Image
from transparent_background import Remover


def process_one(input_path: Path, output_path: Path) -> None:
    remover = Remover()

    img = Image.open(input_path).convert("RGB")

    # 1. Achtergrond transparant maken met InSPyReNet
    fg = remover.process(img, type="rgba")  # RGBA-output

    # 2. Witte achtergrond erachter zetten
    if fg.mode != "RGBA":
        fg = fg.convert("RGBA")
    white_bg = Image.new("RGBA", fg.size, (255, 255, 255, 255))
    white_bg.paste(fg, mask=fg.split()[3])

    # 3. Opslaan als JPG met witte achtergrond
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
        process_one(input_path, output_path)
    except Exception as exc:  # noqa: BLE001
        print(f"Fout tijdens verwerken: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

