import { ImageResponse } from "next/og";

export const alt = "Quick Imposter free online word game";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#f4efe6",
          color: "#10162f",
          padding: "72px 82px",
          flexDirection: "column",
          justifyContent: "space-between",
          border: "22px solid #10162f",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span>Quick Imposter</span>
          <span
            style={{
              display: "flex",
              background: "#ff5f57",
              padding: "12px 20px",
              border: "4px solid #10162f",
              borderRadius: 14,
            }}
          >
            Free to play
          </span>
        </div>
        <div
          style={{
            display: "flex",
            maxWidth: 920,
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 82,
              lineHeight: 0.95,
              fontWeight: 900,
              letterSpacing: "-0.055em",
              textTransform: "uppercase",
            }}
          >
            Imposter Game Online
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 30,
              fontSize: 34,
              fontWeight: 650,
            }}
          >
            One phone. Secret words. Ready in 30 seconds.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            display: "flex",
            right: -70,
            bottom: -92,
            width: 310,
            height: 310,
            borderRadius: 999,
            background: "#2d5bff",
            border: "18px solid #10162f",
          }}
        />
      </div>
    ),
    size,
  );
}
