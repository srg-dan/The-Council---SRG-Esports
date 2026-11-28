import React, { useEffect, useRef, useState } from 'react';
import { Check, Crop, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { AvatarCropSource, SquareCropRect } from '../utils/imageCompression.ts';

interface AvatarCropModalProps {
  source: AvatarCropSource | null;
  onCancel: () => void;
  onConfirm: (crop: SquareCropRect) => Promise<void> | void;
}

const CROP_BOX_SIZE = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  source,
  onCancel,
  onConfirm,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [applying, setApplying] = useState(false);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setApplying(false);
  }, [source]);

  useEffect(() => {
    if (!source) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [source, applying, onCancel]);

  if (!source) return null;

  const { naturalWidth, naturalHeight, previewUrl } = source;
  const baseScale = Math.max(CROP_BOX_SIZE / naturalWidth, CROP_BOX_SIZE / naturalHeight);
  const scale = baseScale * zoom;
  const dispW = naturalWidth * scale;
  const dispH = naturalHeight * scale;
  const maxPanX = Math.max(0, (dispW - CROP_BOX_SIZE) / 2);
  const maxPanY = Math.max(0, (dispH - CROP_BOX_SIZE) / 2);

  const clampPan = (x: number, y: number, limitX: number, limitY: number) => ({
    x: Math.max(-limitX, Math.min(limitX, x)),
    y: Math.max(-limitY, Math.min(limitY, y)),
  });

  const clampedPan = clampPan(pan.x, pan.y, maxPanX, maxPanY);
  const imgLeft = (CROP_BOX_SIZE - dispW) / 2 + clampedPan.x;
  const imgTop = (CROP_BOX_SIZE - dispH) / 2 + clampedPan.y;

  const handleZoomChange = (nextZoomRaw: number) => {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(nextZoomRaw.toFixed(2))));
    const nextScale = baseScale * nextZoom;
    const nextDispW = naturalWidth * nextScale;
    const nextDispH = naturalHeight * nextScale;
    const nextMaxX = Math.max(0, (nextDispW - CROP_BOX_SIZE) / 2);
    const nextMaxY = Math.max(0, (nextDispH - CROP_BOX_SIZE) / 2);
    setZoom(nextZoom);
    setPan((prev) => clampPan(prev.x, prev.y, nextMaxX, nextMaxY));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (applying) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      panX: clampedPan.x,
      panY: clampedPan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    setPan(
      clampPan(
        dragStartRef.current.panX + dx,
        dragStartRef.current.panY + dy,
        maxPanX,
        maxPanY
      )
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer already released
      }
    }
    setDragging(false);
    dragStartRef.current = null;
  };

  const handleConfirm = async () => {
    if (applying) return;
    setApplying(true);
    const sx = Math.max(0, -imgLeft / scale);
    const sy = Math.max(0, -imgTop / scale);
    const sSize = Math.min(naturalWidth - sx, naturalHeight - sy, CROP_BOX_SIZE / scale);
    try {
      await onConfirm({ sx, sy, sSize });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/12 bg-white dark:bg-[#18181E] p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E31E24]/15 text-[#E31E24]">
              <Crop className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="avatar-crop-title"
                className="font-display text-lg font-bold text-zinc-900 dark:text-white"
              >
                Crop Profile Picture
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Drag to reposition and zoom to frame your 512×512 square avatar.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={applying}
            onClick={onCancel}
            aria-label="Close crop dialog"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Interactive Square Crop Viewport */}
        <div className="flex justify-center">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ width: CROP_BOX_SIZE, height: CROP_BOX_SIZE }}
            className={`relative overflow-hidden rounded-2xl border-2 border-[#E31E24] bg-zinc-950 select-none touch-none ${
              dragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <img
              src={previewUrl}
              alt="Crop preview"
              draggable={false}
              style={{
                width: dispW,
                height: dispH,
                left: imgLeft,
                top: imgTop,
              }}
              className="pointer-events-none absolute max-w-none select-none"
            />

            {/* Rule-of-thirds & avatar framing overlay */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
              <div className="absolute inset-2 rounded-2xl border border-dashed border-white/40" />
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="space-y-2 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] p-3.5">
          <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
            <span className="font-medium">Zoom</span>
            <div className="flex items-center gap-2">
              <span className="font-mono tabular-nums">{zoom.toFixed(2)}×</span>
              <button
                type="button"
                disabled={applying}
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:border-[#E31E24] cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={applying || zoom <= MIN_ZOOM}
              onClick={() => handleZoomChange(zoom - 0.15)}
              aria-label="Zoom out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] text-zinc-700 dark:text-zinc-300 disabled:opacity-40 cursor-pointer"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.02}
              value={zoom}
              disabled={applying}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              aria-label="Crop zoom level"
              className="w-full accent-[#E31E24] cursor-pointer"
            />
            <button
              type="button"
              disabled={applying || zoom >= MAX_ZOOM}
              onClick={() => handleZoomChange(zoom + 0.15)}
              aria-label="Zoom in"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] text-zinc-700 dark:text-zinc-300 disabled:opacity-40 cursor-pointer"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={applying}
            onClick={onCancel}
            className="min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={applying}
            onClick={() => void handleConfirm()}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#E31E24] px-5 py-2 text-xs font-semibold text-white hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>{applying ? 'Applying Crop...' : 'Crop & Upload'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
