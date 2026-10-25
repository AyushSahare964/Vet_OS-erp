import { useRef, useState } from "react";
import { PenLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const KEY = "vetechiq.doctorSignature";
/** The doctor's signature is remembered on this device so it is drawn once, not per consultation. */
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

interface Props {
  label?: string;
  /** Called with a PNG data URL, or "" when the signature is removed. */
  onChange: (dataUrl: string) => void;
  hasSignature?: boolean;
  className?: string;
}

/** Draw-to-sign button + dialog (mouse, touch or stylus). */
export function SignatureCapture({ label = "Sign", onChange, hasSignature, className }: Props) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

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
  };
  const done = () => {
    if (canvas.current && dirty) onChange(canvas.current.toDataURL("image/png"));
    setOpen(false);
    setDirty(false);
  };

  // Uploaded image is downscaled onto a canvas so the saved data URL stays small.
  const upload = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 800 / img.width, 300 / img.height);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      onChange(c.toDataURL("image/png"));
      setOpen(false);
    };
    img.src = URL.createObjectURL(file);
  };

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Digital signature</DialogTitle>
            <DialogDescription>Draw your signature below, or upload an image of it.</DialogDescription>
          </DialogHeader>
          <canvas
            ref={canvas}
            width={800}
            height={300}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={() => (drawing.current = false)}
            className="h-44 w-full touch-none rounded-lg border border-dashed border-slate-400 bg-white"
          />
          <DialogFooter>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="size-4" /> Upload image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </Button>
            <Button variant="ghost" onClick={clear}>Clear</Button>
            <Button onClick={done} disabled={!dirty}>Use signature</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
