import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, Space, Typography } from 'antd';
import { ClearOutlined } from '@ant-design/icons';

interface HandwrittenSignaturePadProps {
  width?: number;
  height?: number;
  onChange: (dataUrl: string | null) => void;
}

/**
 * Canvas vẽ chữ ký tay — xuất PNG data URL khi người dùng vẽ xong.
 */
export function HandwrittenSignaturePad({
  width = 440,
  height = 160,
  onChange,
}: HandwrittenSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const emitChange = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInkRef.current) {
      onChange(null);
      return;
    }
    onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
    setHasInk(false);
    onChange(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    if (!hasInkRef.current) {
      hasInkRef.current = true;
      setHasInk(true);
    }
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    emitChange();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Typography.Text type="secondary">Vẽ chữ ký bằng chuột hoặc ngón tay</Typography.Text>
        <Button size="small" icon={<ClearOutlined />} onClick={clear} disabled={!hasInk}>
          Xóa chữ ký
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full border border-[var(--app-border)] rounded-md bg-[var(--app-surface)] touch-none cursor-crosshair"
        style={{ maxWidth: '100%', height: 'auto', aspectRatio: `${width} / ${height}` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <Space className="mt-1">
        <Typography.Text type="secondary" className="text-xs">
          {hasInk ? 'Đã có chữ ký — có thể bấm xác nhận.' : 'Chưa có nét ký.'}
        </Typography.Text>
      </Space>
    </div>
  );
}
