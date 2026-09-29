import { useEffect, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { cn } from '@dculus/utils';
import type { PexelsVideo } from '../../services/pexelsService';

// Smallest mp4 rendition keeps hover previews light.
export function getPexelsPreviewSrc(video: PexelsVideo): string | undefined {
  const mp4s = video.video_files.filter(f => f.file_type === 'video/mp4');
  return [...mp4s].sort((a, b) => a.width - b.width)[0]?.link;
}

// Spread `handlers` on the hoverable/focusable container (which must be `relative`).
export function useHoverPreview() {
  const [active, setActive] = useState(false);
  const handlers = {
    onMouseEnter: () => setActive(true),
    onMouseLeave: () => setActive(false),
    onFocus: () => setActive(true),
    onBlur: () => setActive(false),
  };
  return { active, handlers };
}

interface HoverPreviewVideoProps {
  poster: string;
  src?: string;
  alt: string;
  active: boolean;
  iconClassName?: string;
}

// The video is mounted only while active, so idle thumbnails download no video data.
export function HoverPreviewVideo({
  poster,
  src,
  alt,
  active,
  iconClassName = 'h-6 w-6',
}: HoverPreviewVideoProps) {
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!active) {
      setPlaying(false);
      setWaiting(false);
    }
  }, [active]);

  const showVideo = active && !!src;
  const loading = showVideo && (!playing || waiting);

  return (
    <>
      <img src={poster} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      {showVideo && (
        <video
          src={src}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-200',
            playing ? 'opacity-100' : 'opacity-0'
          )}
          muted
          loop
          autoPlay
          playsInline
          onWaiting={() => setWaiting(true)}
          onPlaying={() => {
            setPlaying(true);
            setWaiting(false);
          }}
        />
      )}
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
          <Loader2 className={cn(iconClassName, 'text-white animate-spin')} />
        </div>
      ) : (
        !showVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <Play className={cn(iconClassName, 'text-white/90')} />
          </div>
        )
      )}
    </>
  );
}
