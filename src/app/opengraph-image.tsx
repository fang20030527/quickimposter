import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt = "Quick Imposter free online word game";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

async function getLogoDataUrl() {
  const logoData = await readFile(
    join(process.cwd(), "public/quick-imposter-logo.png"),
    "base64",
  );

  return `data:image/png;base64,${logoData}`;
}

export default async function OpenGraphImage() {
  const logoSrc = await getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#ffffff",
          color: "#10162f",
          padding: "34px 50px 34px 30px",
          alignItems: "center",
          justifyContent: "space-between",
          border: "22px solid #10162f",
        }}
      >
        <img
          src={logoSrc}
          alt=""
          width={540}
          height={540}
          style={{ objectFit: "contain" }}
        />
        <div
          style={{
            display: "flex",
            width: 510,
            height: "100%",
            padding: "54px 0 52px",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#6d1cc2",
              fontSize: 25,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Free party word game
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 68,
              lineHeight: 0.98,
              fontWeight: 900,
              letterSpacing: "-0.05em",
            }}
          >
            Imposter Game Online
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 29,
              lineHeight: 1.2,
              fontWeight: 650,
            }}
          >
            One phone. Secret words. Ready in 30 seconds.
          </div>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginTop: 34,
              padding: "12px 20px",
              border: "4px solid #10162f",
              borderRadius: 14,
              background: "#ffbf00",
              fontSize: 26,
              fontWeight: 850,
            }}
          >
            Play free — no signup
          </div>
        </div>
      </div>
    ),
    size,
  );
}
