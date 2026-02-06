import { useEffect, useRef } from 'react';
import { X, ArrowUpRight } from 'lucide-react';
import { getProfileByIndex } from '../data/presetProfiles';

interface BusinessCardPopupProps {
  profileIndex: number;
  onClose: () => void;
}

function generateInitialsAvatar(name: string, bgColor: string, size: number = 120): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Subtle gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, bgColor);
  gradient.addColorStop(1, bgColor + 'cc');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `300 ${size * 0.42}px "Space Grotesk", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, size / 2, size / 2 + 2);

  return canvas.toDataURL('image/png');
}

export function BusinessCardPopup({ profileIndex, onClose }: BusinessCardPopupProps) {
  const profile = getProfileByIndex(profileIndex);
  const avatarUrl = generateInitialsAvatar(profile.name, profile.initialsColor);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    // Animate in
    requestAnimationFrame(() => {
      if (cardRef.current) {
        cardRef.current.style.opacity = '1';
        cardRef.current.style.transform = 'translateY(0) scale(1)';
      }
    });

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-30"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Card container */}
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div
          ref={cardRef}
          className="pointer-events-auto relative"
          style={{
            width: 380,
            maxWidth: '92%',
            background: 'linear-gradient(135deg, rgba(24,24,27,0.97) 0%, rgba(32,32,38,0.97) 100%)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset',
            opacity: 0,
            transform: 'translateY(12px) scale(0.97)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            fontFamily: '"Space Grotesk", sans-serif',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Accent line */}
          <div
            style={{
              height: 3,
              borderRadius: '16px 16px 0 0',
              background: `linear-gradient(90deg, ${profile.initialsColor}, ${profile.initialsColor}88, transparent)`,
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
            }}
          >
            <X size={14} />
          </button>

          {/* Content */}
          <div style={{ padding: '28px 32px 32px' }}>
            {/* Top row: avatar + name */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <img
                src={avatarUrl}
                alt={profile.name}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#fff',
                    margin: 0,
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {profile.name}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: profile.initialsColor,
                    margin: '4px 0 0',
                    letterSpacing: '0.01em',
                  }}
                >
                  {profile.profession}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 300,
                    color: 'rgba(255,255,255,0.35)',
                    margin: '2px 0 0',
                    letterSpacing: '0.02em',
                  }}
                >
                  {profile.company}
                </p>
              </div>
            </div>

            {/* Bio */}
            <p
              style={{
                fontSize: 12.5,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.45)',
                margin: '20px 0 0',
                fontWeight: 300,
              }}
            >
              {profile.bio}
            </p>

            {/* Divider */}
            <div
              style={{
                height: 1,
                background: 'rgba(255,255,255,0.06)',
                margin: '20px 0',
              }}
            />

            {/* Contact grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ContactRow label="Email" value={profile.email} color={profile.initialsColor} />
              <ContactRow label="Phone" value={profile.phone} color={profile.initialsColor} />
              <ContactRow label="LinkedIn" value={profile.linkedin} color={profile.initialsColor} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ContactRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span
        style={{
          fontSize: 10,
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 400,
          color: color + '99',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          flexShrink: 0,
          width: 56,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.65)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
      {label === 'LinkedIn' && (
        <ArrowUpRight
          size={12}
          style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}
        />
      )}
    </div>
  );
}
