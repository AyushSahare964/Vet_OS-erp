import { useMemo, useRef, useState } from "react";
import { PenLine, RotateCcw, RotateCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignatureDocPreview } from "./SignatureDocPreview";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const KEY = "vetechiq.doctorSignature";
/** A doctor's own signature is remembered on this device so it is drawn once, not per consultation. */
export function loadDoctorSignature(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
export function saveDoctorSignature(url: string) {
  try {
    url ? localStorage.setItem(KEY, url) : localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — signature just won't persist */
  }
}

/** `img` turned by `angle` degrees on a white canvas that fits maxW x maxH. */
function renderRotated(img: HTMLImageElement, angle: number, maxW: number, maxH: number): HTMLCanvasElement {
  const t = (angle * Math.PI) / 180;
  const w = Math.abs(img.width * Math.cos(t)) + Math.abs(img.height * Math.sin(t));
  const h = Math.abs(img.width * Math.sin(t)) + Math.abs(img.height * Math.cos(t));
  const scale = Math.min(1, maxW / w, maxH / h);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(t);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return c;
}

interface Crop { x0: number; y0: number; x1: number; y1: number }
const norm = (c: Crop) => ({ x: Math.min(c.x0, c.x1), y: Math.min(c.y0, c.y1), w: Math.abs(c.x1 - c.x0), h: Math.abs(c.y1 - c.y0) });

/**
 * Crops (if a box was drawn), shrinks to at most 500x180 and encodes. The signature is saved in the database and
 * sent with every page load, so it is kept small: PNG when that is tiny, otherwise JPEG.
 */
function finish(src: HTMLCanvasElement, crop: Crop | null): string {
  let from = src;
  const r = crop ? norm(crop) : null;
  if (r && r.w > 0.03 && r.h > 0.03) {
    const sx = Math.round(r.x * src.width), sy = Math.round(r.y * src.height);
    const sw = Math.max(1, Math.round(r.w * src.width)), sh = Math.max(1, Math.round(r.h * src.height));
    from = document.createElement("canvas");
    from.width = sw;
    from.height = sh;
    from.getContext("2d")!.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  }
  const scale = Math.min(1, 500 / from.width, 180 / from.height);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(from.width * scale));
  out.height = Math.max(1, Math.round(from.height * scale));
  out.getContext("2d")!.drawImage(from, 0, 0, out.width, out.height);
  const png = out.toDataURL("image/png");
  return png.length <= 90_000 ? png : out.toDataURL("image/jpeg", 0.85);
}

interface Props {
  label?: string;
  /** Called with an image data URL, or "" when the signature is removed. */
  onChange: (dataUrl: string) => void;
  hasSignature?: boolean;
  className?: string;
  /** When given, the dialog previews the signature in the prescription and bill footers with this doctor's details. */
  doctor?: { name: string; title?: string };
  /** The signature already saved, shown in the preview until a new one is drawn. */
  current?: string;
}

/** Draw-to-sign button + dialog (mouse, touch or stylus), or upload a photo, rotate it upright and crop it. */
export function SignatureCapture({ label = "Sign", onChange, hasSignature, className, doctor, current }: Props) {
  const [live, setLive] = useState("");
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [angle, setAngle] = useState(0);
  const [crop, setCrop] = useState<Crop | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const cropping = useRef(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * e.currentTarget.width) / r.width, y: ((e.clientY - r.top) * e.currentTarget.height) / r.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d")!;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const { x, y } = pos(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
    setDirty(true);
  };
  const clear = () => {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setDirty(false);
    setLive("");
  };
  const close = () => {
    setLive("");
    if (photo) URL.revokeObjectURL(photo.src);
    setPhoto(null);
    setAngle(0);
    setCrop(null);
    setDirty(false);
    setOpen(false);
  };
  const done = () => {
    if (canvas.current && dirty) onChange(canvas.current.toDataURL("image/png"));
    close();
  };

  // An uploaded photo opens in a rotate + crop step first (photos are often sideways, upside down or full of paper).
  const upload = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const img = new Image();
    img.onload = () => {
      setAngle(0);
      setCrop(null);
      setPhoto(img);
    };
    img.src = URL.createObjectURL(file);
  };
  const rotated = useMemo(() => (photo ? renderRotated(photo, angle, 1400, 600) : null), [photo, angle]);
  const preview = useMemo(() => (rotated ? rotated.toDataURL("image/jpeg", 0.8) : ""), [rotated]);
  const photoSig = useMemo(() => (rotated ? finish(rotated, crop) : ""), [rotated, crop]);
  const previewBlock = doctor && (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">Preview: how it will look on documents</p>
      <SignatureDocPreview signature={photo ? photoSig : live || current || ""} doctorName={doctor.name} title={doctor.title} />
    </div>
  );
  const rotateBy = (d: number) => {
    setAngle((a) => ((a + d + 540) % 360) - 180);
    setCrop(null); // a crop box belongs to one orientation
  };
  const usePhoto = () => {
    if (!rotated) return;
    onChange(finish(rotated, crop));
    close();
  };

  // Drag on the preview to draw the crop box
  const frac = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const cropDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    cropping.current = true;
    const p = frac(e);
    setCrop({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const cropMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropping.current) return;
    const p = frac(e);
    setCrop((c) => (c ? { ...c, x1: p.x, y1: p.y } : c));
  };
  const box = crop ? norm(crop) : null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className={`gap-1.5 text-xs print:hidden ${className ?? ""}`}>
        <PenLine className="size-3.5" /> {hasSignature ? "Re-sign" : label}
      </Button>
      {hasSignature && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} className="text-xs text-muted-foreground print:hidden">
          Remove
        </Button>
      )}
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent className={doctor ? "max-h-[92vh] max-w-3xl overflow-y-auto" : "max-w-lg"}>
          <DialogHeader>
            <DialogTitle>Digital signature</DialogTitle>
            <DialogDescription>
              {photo ? "Turn the photo until the signature is upright, then drag on it to crop." : "Draw your signature below, or upload a photo of it."}
            </DialogDescription>
          </DialogHeader>

          {photo ? (
            <>
              <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-400 bg-white">
                <div
                  className="relative inline-block max-h-full max-w-full cursor-crosshair touch-none select-none overflow-hidden"
                  onPointerDown={cropDown}
                  onPointerMove={cropMove}
                  onPointerUp={() => (cropping.current = false)}
                >
                  <img src={preview} alt="Signature preview" draggable={false} className="block max-h-48 max-w-full object-contain" />
                  {box && box.w > 0.01 && box.h > 0.01 && (
                    <div
                      className="pointer-events-none absolute border-2 border-blue-600"
                      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, boxShadow: "0 0 0 9999px rgba(15,23,42,0.45)" }}
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => rotateBy(-90)} className="gap-1">
                  <RotateCcw className="size-4" /> Left
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => rotateBy(90)} className="gap-1">
                  <RotateCw className="size-4" /> Right
                </Button>
                <input
                  type="range" min={-180} max={180} step={1} value={angle}
                  onChange={(e) => { setAngle(Number(e.target.value)); setCrop(null); }}
                  aria-label="Fine rotation" className="flex-1"
                />
                <span className="w-12 text-right font-mono text-xs text-muted-foreground">{angle}°</span>
              </div>
              {previewBlock}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCrop(null)} disabled={!crop}>Reset crop</Button>
                <Button variant="ghost" onClick={() => { URL.revokeObjectURL(photo.src); setPhoto(null); setAngle(0); setCrop(null); }}>Back</Button>
                <Button onClick={usePhoto}>{crop && box && box.w > 0.03 && box.h > 0.03 ? "Crop & use" : "Use this photo"}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <canvas
                ref={canvas}
                width={800}
                height={300}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={(e) => { drawing.current = false; setLive(e.currentTarget.toDataURL("image/png")); }}
                className="h-44 w-full touch-none rounded-lg border border-dashed border-slate-400 bg-white"
              />
              {previewBlock}
              <DialogFooter>
                <Button variant="outline" asChild>
                  <label className="cursor-pointer">
                    <Upload className="size-4" /> Upload photo
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                </Button>
                <Button variant="ghost" onClick={clear}>Clear</Button>
                <Button onClick={done} disabled={!dirty}>Use signature</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
