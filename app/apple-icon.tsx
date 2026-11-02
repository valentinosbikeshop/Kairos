import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
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
          color: '#FAFAFA',
          fontSize: 108,
          fontWeight: 900,
          letterSpacing: '-0.05em',
        }}
      >
        K
      </div>
    ),
    { ...size }
  );
}
