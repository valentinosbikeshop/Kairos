import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090B',
          borderRadius: '112px',
          border: '12px solid #27272A',
          color: '#FAFAFA',
          fontSize: 280,
          fontWeight: 900,
          letterSpacing: '-0.06em',
        }}
      >
        K
      </div>
    ),
    { ...size }
  );
}
