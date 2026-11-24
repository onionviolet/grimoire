import { memo, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { normalizeCrosshairSettings } from '../../lib/crosshair';
import type { CrosshairSettings } from '../../types/electron';
import { useCrosshairStore } from '../../stores/crosshairStore';
import { drawCrosshair } from './drawCrosshair';

interface CrosshairPreviewProps {
    size?: number;
    // Resolution factor (display height / 1080): the device grid the
    // crosshair is pixel-snapped to.
    scale?: number;
    // Magnification applied after snapping; enlarges device pixels instead of
    // re-rasterizing the crosshair finer.
    zoom?: number;
    // Optional override settings (for displaying saved presets/profiles;
    // legacy shapes are normalized inside the renderer)
    settings?: Partial<CrosshairSettings>;
    // Render with transparent background instead of gray
    transparent?: boolean;
    spreadPreview?: boolean;
}

export default memo(function CrosshairPreview({ size = 200, scale = 1, zoom = 1, settings, transparent, spreadPreview }: CrosshairPreviewProps) {
    // Preset canvases do not subscribe to edits in the live editor. Live canvases
    // only redraw when crosshair settings change, not preset/loading metadata.
    const s = useCrosshairStore(useShallow((state) => settings ?? normalizeCrosshairSettings(state)));
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Backing store at device resolution so the crosshair stays crisp
        const dpr = window.devicePixelRatio || 1;
        // Assigning either dimension clears and reallocates the backing store,
        // even if it has not changed. Most edits only need another draw.
        const pixels = Math.round(size * dpr);
        if (canvas.width !== pixels) canvas.width = pixels;
        if (canvas.height !== pixels) canvas.height = pixels;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const options = { size, scale, zoom, background: transparent ? null : '#555' };
        drawCrosshair(ctx, s, options);
        if (!spreadPreview) return;
        const start = performance.now();
        let frame: number;
        const draw = (now: number) => {
            const progress = Math.min(1, (now - start) / 850);
            const spread = progress < 0.18 ? progress / 0.18 : ((1 - progress) / 0.82) ** 2;
            drawCrosshair(ctx, { ...s, pipGap: (s.pipGap ?? 0) + spread * 12 }, options);
            if (progress < 1) frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [s, size, scale, zoom, transparent, spreadPreview]);

    return (
        <canvas
            ref={canvasRef}
            className="rounded-lg"
            style={{ width: size, height: size }}
        />
    );
});
